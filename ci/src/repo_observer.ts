import * as fs from 'fs'
import * as net from 'net'
import { execSync } from 'child_process'
import * as process from 'process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as path from 'path'

interface Args {
  dispatcherServer: string
  repo: string
}

function parseArgs(): Args {
  const argv = yargs(hideBin(process.argv))
    .option('dispatcher-server', {
      describe: 'dispatcher host:port, by default it uses localhost:8888',
      default: 'localhost:8888',
      type: 'string',
    })
    .option('repo', {
      describe: 'repository to observe',
      default: path.resolve(__dirname, 'test_git_folder'),
      type: 'string',
    })
    .parseSync()

  return {
    dispatcherServer: argv['dispatcher-server'],
    repo: argv['repo'] as string,
  }
}

function communicate(host: string, port: number, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()

    client.connect(port, host, () => {
      client.write(message)
    })

    client.on('data', (data) => {
      resolve(data.toString())
      client.destroy() // kill client after server's response
    })

    client.on('error', (err) => {
      reject(err)
    })

    client.on('close', () => {
      // Connection closed
    })
  })
}

async function poll() {
  const args = parseArgs()
  const [dispatcherHost, dispatcherPort] = args.dispatcherServer.split(':')

  while (true) {
    try {
      execSync(`./update_repo.sh ${args.repo}`, { stdio: 'inherit' })
    } catch (e) {
      throw new Error(`Could not update and check repository. Reason: ${e.message}`)
    }

    if (fs.existsSync('.commit_id')) {
      try {
        const response = await communicate(dispatcherHost, parseInt(dispatcherPort), 'status')

        if (response.trim() === 'OK') {
          const commit = fs.readFileSync('.commit_id', 'utf-8').trim()
          const dispatchResponse = await communicate(
            dispatcherHost,
            parseInt(dispatcherPort),
            `dispatch:${commit}`,
          )

          if (dispatchResponse.trim() !== 'OK') {
            throw new Error(`Could not dispatch the test: ${dispatchResponse}`)
          }
          console.log('dispatched!')
        } else {
          throw new Error(`Could not dispatch the test: ${response}`)
        }
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
