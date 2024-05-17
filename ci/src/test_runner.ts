import * as fs from 'fs'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import * as process from 'process'
import * as readline from 'readline'
import * as yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { execSync } from 'child_process'
import { setInterval, setTimeout } from 'timers'
import * as helpers from './helpers'
import { Mutex } from 'async-mutex'

const commandRe = new RegExp(/(\w+)(:.+)*?/)
const BUF_SIZE = 1024

interface Runner {
  host: string
  port: number
}

class TestHandler {
  server: any
  request: net.Socket
  data: Buffer

  constructor(server: any, request: net.Socket) {
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
      if (command === 'ping') {
        console.log('pinged')
        this.server.lastCommunication = Date.now()
        this.request.write('pong')
      } else if (command === 'runtest') {
        console.log(`got runtest command: am I busy? ${this.server.busy}`)
        if (this.server.busy) {
          this.request.write('BUSY')
        } else {
          this.request.write('OK')
          console.log('running')
          const commitId = commandGroups[2]?.slice(1)
          this.server.busy = true
          await this.runTests(commitId, this.server.repoFolder)
          this.server.busy = false
        }
      } else {
        this.request.write('Invalid command')
      }
      this.request.end()
    })
  }

  async runTests(commitId: string, repoFolder: string) {
    try {
      // update repo
      const output = execSync(`./test_runner_script.sh ${repoFolder} ${commitId}`).toString()
      console.log(output)
      // run the tests
      const testFolder = path.join(repoFolder, 'tests')
      const testRunner = `jest ${testFolder} --json --outputFile=results`
      execSync(testRunner)

      const result = fs.readFileSync('results', 'utf-8')
      await helpers.communicate(
        this.server.dispatcherServer.host,
        parseInt(this.server.dispatcherServer.port),
        `results:${commitId}:${result.length}:${result}`,
      )
    } catch (error) {
      console.error(`Error running tests: ${error}`)
    }
  }
}

async function serve() {
  const rangeStart = 8900
  const args = yargs(hideBin(process.argv))
    .option('host', {
      describe: "runner's host, by default it uses localhost",
      default: 'localhost',
      type: 'string',
    })
    .option('port', {
      describe: `runner's port, by default it uses values >=${rangeStart}`,
      type: 'number',
    })
    .option('dispatcher-server', {
      describe: 'dispatcher host:port, by default it uses localhost:8888',
      default: 'localhost:8888',
      type: 'string',
    })
    .demandCommand(1)
    .parseSync()

  const runnerHost = args.host
  let runnerPort = args.port
  let tries = 0
  let server: net.Server

  if (!runnerPort) {
    runnerPort = rangeStart
    while (tries < 100) {
      try {
        server = net
          .createServer((socket) => {
            const handler = new TestHandler(server, socket)
            handler.handle()
          })
          .listen(runnerPort, runnerHost)

        console.log(server)
        console.log(runnerPort)
        break
      } catch (e) {
        if ((e as any).code === 'EADDRINUSE') {
          tries += 1
          runnerPort += 1
          continue
        } else {
          throw e
        }
      }
    }
    if (tries >= 100) {
      throw new Error(`Could not bind to ports in range ${rangeStart}-${rangeStart + tries}`)
    }
  } else {
    server = net
      .createServer((socket) => {
        const handler = new TestHandler(server, socket)
        handler.handle()
      })
      .listen(runnerPort, runnerHost)
  }

  const [dispatcherHost, dispatcherPort] = args.dispatcherServer.split(':')
  server.repoFolder = args.repo
  server.dispatcherServer = { host: dispatcherHost, port: dispatcherPort }

  const response = await helpers.communicate(
    server.dispatcherServer.host,
    parseInt(server.dispatcherServer.port),
    `register:${runnerHost}:${runnerPort}`,
  )
  if (response !== 'OK') {
    throw new Error("Can't register with dispatcher!")
  }

  const dispatcherChecker = async (server: any) => {
    while (!server.dead) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
      if (Date.now() - server.lastCommunication > 10000) {
        try {
          const response = await helpers.communicate(
            server.dispatcherServer.host,
            parseInt(server.dispatcherServer.port),
            'status',
          )
          if (response !== 'OK') {
            console.log('Dispatcher is no longer functional')
            server.close()
            return
          }
        } catch (e) {
          console.log(`Can't communicate with dispatcher: ${e}`)
          server.close()
          return
        }
      }
    }
  }

  const t = dispatcherChecker(server)
  try {
    // Activate the server; this will keep running until you
    // interrupt the program with Ctrl-C
    await new Promise((resolve) => server.on('close', resolve))
  } catch (e) {
    // if any exception occurs, kill the thread
    server.dead = true
    await t
  }
}

if (require.main === module) {
  serve().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
