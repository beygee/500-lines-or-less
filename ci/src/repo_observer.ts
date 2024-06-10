import * as fs from 'fs'
import { execSync } from 'child_process'
import * as process from 'process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { Socket, connect } from 'socket.io-client'

interface Args {
  dispatcherServer: string
  repo: string
}

function parseArgs(): Args {
  const argv = yargs(hideBin(process.argv))
    .option('dispatcher-server', {
      describe: 'dispatcher host:port, by default it uses 127.0.0.1:8888',
      default: '127.0.0.1:8888',
      type: 'string',
    })
    .option('repo', {
      describe: 'repository to observe',
      default: path.resolve(__dirname, '..', 'test_git_folder'),
      type: 'string',
    })
    .parseSync()

  return {
    dispatcherServer: argv['dispatcher-server'],
    repo: argv['repo'] as string,
  }
}

async function communicate(socket: Socket, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.emit('data', message)

    socket.on('response', (data) => {
      resolve(data)
    })

    socket.on('error', (err) => {
      reject(err)
    })
  })
}

async function poll() {
  const args = parseArgs()
  const [dispatcherHost, dispatcherPort] = args.dispatcherServer.split(':')

  console.log(dispatcherHost, dispatcherPort)
  const socket = connect(`ws://${dispatcherHost}:${dispatcherPort}`, {
    transports: ['websocket'],
    secure: false,
    rejectUnauthorized: false,
  })

  socket.on('connect_error', (err: any) => {
    console.error(`Could not connect to dispatcher server: ${err}`)
    console.error(err.description)
  })
  socket.on('connect', () => {
    console.log('Connected to dispatcher server')
  })

  const db = await open({
    filename: './db/database.db',
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  })

  while (true) {
    try {
      execSync(`./update_repo.sh ${args.repo}`, { stdio: 'inherit' })
    } catch (e) {
      throw new Error(`Could not update and check repository. Reason: ${e.message}`)
    }
    if (fs.existsSync(path.resolve(args.repo, '.commit_id'))) {
      try {
        // const response = await communicate(socket, 'status')
        // // console.log(response)
        // if (response.trim() === 'OK') {
        //   const commit = fs.readFileSync('.commit_id', 'utf-8').trim()
        //   const dispatchResponse = await communicate(socket, `dispatch:${commit}`)
        //   if (dispatchResponse.trim() !== 'OK') {
        //     throw new Error(`Could not dispatch the test: ${dispatchResponse}`)
        //   }
        //   console.log('dispatched!')
        // } else {
        //   throw new Error(`Could not dispatch the test: ${response}`)
        // }
      } catch (e) {
        throw new Error(`Could not communicate with dispatcher server: ${e.message}`)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

if (require.main === module) {
  poll().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
