import * as net from 'net'

export function communicate(host: string, port: number, request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()

    client.connect(port, host, () => {
      client.write(request)
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
