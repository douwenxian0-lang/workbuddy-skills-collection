import { createServer } from 'node:net'

async function detectLoopbackListenCapability(): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createServer()

    const finish = (result: boolean) => {
      server.removeAllListeners()
      if (server.listening) {
        server.close(() => resolve(result))
        return
      }
      resolve(result)
    }

    server.once('error', () => finish(false))
    server.listen(0, '127.0.0.1', () => finish(true))
  })
}

export const LOOPBACK_LISTEN_AVAILABLE = await detectLoopbackListenCapability()
