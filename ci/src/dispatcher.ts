import * as fs from 'fs'
import * as path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { setTimeout } from 'timers'
import * as helpers from './helpers'
import { Mutex } from 'async-mutex'

import { Server, Socket } from 'socket.io'
import { createServer } from 'http'

const commandRe = new RegExp(/(\w+)(:.+)*?/)
const BUF_SIZE = 1024

interface Runner {
  host: string
  port: number
}

class DispatcherServer {
  runners: Runner[] = []
  dead: boolean = false
  dispatchedCommits: { [key: string]: Runner } = {}
  pendingCommits: string[] = []

  async dispatchTests(commitId: string) {
    while (true) {
      console.log('trying to dispatch to runners')
      for (const runner of this.runners) {
        try {
          const response = await helpers.communicate(
            runner.host,
            runner.port,
            `runtest:${commitId}`,
          )
          if (response === 'OK') {
            console.log(`adding id ${commitId}`)
            this.dispatchedCommits[commitId] = runner
            const index = this.pendingCommits.indexOf(commitId)
            if (index > -1) {
              this.pendingCommits.splice(index, 1)
            }
            return
          }
        } catch (e) {
          console.error(`Failed to communicate with runner ${runner.host}:${runner.port}`, e)
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
}

class DispatcherHandler {
  server: DispatcherServer
  socket: Socket
  data: Buffer

  constructor(server: DispatcherServer, socket: any) {
    this.server = server
    this.socket = socket
    this.data = Buffer.alloc(0)
  }

  async handle() {
    this.socket.on('data', async (message: string) => {
      console.log(message)
      this.data = Buffer.concat([this.data, Buffer.from(message)])
      const commandGroups = commandRe.exec(message.trim())
      if (!commandGroups) {
        this.socket.emit('response', 'Invalid command')
        return
      }
      const command = commandGroups[1]
      if (command === 'status') {
        console.log('in status')
        this.socket.emit('response', 'OK')
      } else if (command === 'register') {
        console.log('register')
        const address = commandGroups[2]
        const [host, port] = address?.split(':').slice(1) || []
        if (host && port) {
          const runner = { host, port: parseInt(port, 10) }
          this.server.runners.push(runner)
          this.socket.emit('response', 'OK')
        } else {
          this.socket.emit('response', 'Invalid address')
        }
      } else if (command === 'dispatch') {
        console.log('going to dispatch')
        const commitId = commandGroups[2]?.slice(1)
        if (!commitId) {
          this.socket.emit('response', 'Invalid commit ID')
        } else if (!this.server.runners.length) {
          this.socket.emit('response', 'No runners are registered')
        } else {
          this.socket.emit('response', 'OK')
          await this.server.dispatchTests(commitId)
        }
      } else if (command === 'results') {
        console.log('got test results')
        const results = commandGroups[2]?.slice(1).split(':') || []
        const commitId = results[0]
        const lengthMsg = parseInt(results[1], 10)
        if (!commitId || isNaN(lengthMsg)) {
          this.socket.emit('response', 'Invalid results')
        } else {
          const remainingBuffer =
            BUF_SIZE - (command.length + commitId.length + results[1].length + 3)
          if (lengthMsg > remainingBuffer) {
            this.data = Buffer.concat([
              this.data,
              await this.receiveAdditionalData(lengthMsg - remainingBuffer),
            ])
          }
          delete this.server.dispatchedCommits[commitId]
          if (!fs.existsSync('test_results')) {
            fs.mkdirSync('test_results')
          }
          const data = this.data.toString().split(':').slice(3).join('\n')
          fs.writeFileSync(path.join('test_results', commitId), data)
          this.socket.emit('response', 'OK')
        }
      } else {
        this.socket.emit('response', 'Invalid command')
      }
    })
  }

  receiveAdditionalData(length: number): Promise<Buffer> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = []
      this.socket.on('data', (chunk: string) => {
        const bufferChunk = Buffer.from(chunk)
        chunks.push(bufferChunk)
        if (Buffer.concat(chunks).length >= length) {
          this.socket.removeAllListeners('data')
          resolve(Buffer.concat(chunks))
        }
      })
    })
  }
}

async function serve() {
  const args = yargs(hideBin(process.argv))
    .option('host', {
      describe: "dispatcher's host, by default it uses 127.0.0.1",
      default: '127.0.0.1',
      type: 'string',
    })
    .option('port', {
      describe: "dispatcher's port, by default it uses 8888",
      default: 8888,
      type: 'number',
    })
    .parseSync()

  const server = new DispatcherServer()
  const mutex = new Mutex()

  const runnerChecker = async () => {
    const manageCommitLists = (runner: Runner) => {
      const commitId = Object.keys(server.dispatchedCommits).find(
        (commit) => server.dispatchedCommits[commit] === runner,
      )
      if (commitId) {
        delete server.dispatchedCommits[commitId]
        server.pendingCommits.push(commitId)
      }
      const index = server.runners.indexOf(runner)
      if (index > -1) {
        server.runners.splice(index, 1)
      }
    }

    while (!server.dead) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      for (const runner of server.runners) {
        try {
          const response = await helpers.communicate(runner.host, runner.port, 'ping')
          if (response !== 'pong') {
            console.log(`removing runner ${runner.host}:${runner.port}`)
            await mutex.runExclusive(() => manageCommitLists(runner))
          }
        } catch (e) {
          await mutex.runExclusive(() => manageCommitLists(runner))
        }
      }
    }
  }

  const redistribute = async () => {
    while (!server.dead) {
      for (const commit of server.pendingCommits) {
        console.log('running redistribute')
        console.log(server.pendingCommits)
        await server.dispatchTests(commit)
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }

  const httpServer = createServer()
  const io = new Server(httpServer, { transports: ['websocket'], cors: { origin: '*' } })

  io.on('connection', (socket) => {
    console.log(socket)
    const handler = new DispatcherHandler(server, socket)
    handler.handle()
  })

  io.engine.on('connection_error', (err) => {
    console.log(err.req) // the request object
    console.log(err.code) // the error code, for example 1
    console.log(err.message) // the error message, for example "Session ID unknown"
    console.log(err.context) // some additional error context
  })

  httpServer.listen(args.port, args.host, async () => {
    console.log(`serving on ${args.host}:${args.port}`)

    const runnerHeartbeat = runnerChecker()
    const redistributor = redistribute()

    process.on('SIGINT', () => {
      server.dead = true
      httpServer.close()
      console.log('Server shutting down')
      process.exit()
    })

    await Promise.all([runnerHeartbeat, redistributor])
  })
}

if (require.main === module) {
  serve().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
