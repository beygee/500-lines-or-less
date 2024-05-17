import * as fs from 'fs'
import * as net from 'net'
import * as path from 'path'
import * as process from 'process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { setTimeout } from 'timers'
import * as helpers from './helpers'
import { Mutex } from 'async-mutex'

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
  request: net.Socket
  data: Buffer

  constructor(server: DispatcherServer, request: net.Socket) {
    this.server = server
    this.request = request
    this.data = Buffer.alloc(0)
  }

  async handle() {
    this.request.on('data', (chunk) => {
      this.data = Buffer.concat([this.data, chunk])
    })

    this.request.on('end', async () => {
      const message = this.data.toString().trim()
      const commandGroups = commandRe.exec(message)
      if (!commandGroups) {
        this.request.write('Invalid command')
        this.request.end()
        return
      }
      const command = commandGroups[1]
      if (command === 'status') {
        console.log('in status')
        this.request.write('OK')
      } else if (command === 'register') {
        console.log('register')
        const address = commandGroups[2]
        const [host, port] = address?.split(':').slice(1) || []
        if (host && port) {
          const runner = { host, port: parseInt(port, 10) }
          this.server.runners.push(runner)
          this.request.write('OK')
        } else {
          this.request.write('Invalid address')
        }
      } else if (command === 'dispatch') {
        console.log('going to dispatch')
        const commitId = commandGroups[2]?.slice(1)
        if (!commitId) {
          this.request.write('Invalid commit ID')
        } else if (!this.server.runners.length) {
          this.request.write('No runners are registered')
        } else {
          this.request.write('OK')
          await this.server.dispatchTests(commitId)
        }
      } else if (command === 'results') {
        console.log('got test results')
        const results = commandGroups[2]?.slice(1).split(':') || []
        const commitId = results[0]
        const lengthMsg = parseInt(results[1], 10)
        if (!commitId || isNaN(lengthMsg)) {
          this.request.write('Invalid results')
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
          this.request.write('OK')
        }
      } else {
        this.request.write('Invalid command')
      }
      this.request.end()
    })
  }

  receiveAdditionalData(length: number): Promise<Buffer> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = []
      this.request.on('data', (chunk) => {
        chunks.push(chunk)
        if (Buffer.concat(chunks).length >= length) {
          this.request.removeAllListeners('data')
          resolve(Buffer.concat(chunks))
        }
      })
    })
  }
}

async function serve() {
  const args = yargs(hideBin(process.argv))
    .option('host', {
      describe: "dispatcher's host, by default it uses localhost",
      default: 'localhost',
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

  const tcpServer = net.createServer(async (socket) => {
    const handler = new DispatcherHandler(server, socket)
    await handler.handle()
  })

  tcpServer.listen(args.port, args.host, () => {
    console.log(`serving on ${args.host}:${args.port}`)
  })

  const runnerHeartbeat = runnerChecker()
  const redistributor = redistribute()

  process.on('SIGINT', () => {
    server.dead = true
    tcpServer.close()
    console.log('Server shutting down')
    process.exit()
  })

  await Promise.all([runnerHeartbeat, redistributor])
}

if (require.main === module) {
  serve().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

// npx ts-node src/dispatcher.ts
