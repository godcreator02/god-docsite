import { createServer } from 'node:net'

/**
 * 开发服务与发布版随机挑端口的范围：五位数，避开 49152 以上——那是 Windows 给临时连接用的范围，Hyper-V 还会在里面随机保留几段，挑到那里常常起不来
 */
export const randomPortRange = { from: 10_000, to: 49_151 } as const

/** 挑多少次都占不上就报错：范围里绝大多数端口是空的，连续这么多次占不上说明本机出了别的问题 */
const maxAttempts = 50

/** 在 host 上试着监听 port 再马上关掉：被占用或没权限（EADDRINUSE、EACCES）为 false；本机没有这种地址（EADDRNOTAVAIL，比如关了 IPv6）算空闲 */
function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolve(false)
      else if (error.code === 'EADDRNOTAVAIL') resolve(true)
      else reject(error)
    })
    probe.listen(port, host, () => probe.close(() => resolve(true)))
  })
}

/** 端口在本机两个回环地址上都没人用：开发服务按 localhost 监听，解析成 127.0.0.1 还是 ::1 看系统，两个都要空 */
export async function isPortFree(port: number): Promise<boolean> {
  return (await canListen(port, '127.0.0.1')) && (await canListen(port, '::1'))
}

/** 在 randomPortRange 里随机挑一个此刻没人用的端口；random 换成假的就能测 */
export async function randomFreePort(random: () => number = Math.random): Promise<number> {
  const { from, to } = randomPortRange
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = from + Math.floor(random() * (to - from + 1))
    if (await isPortFree(port)) return port
  }
  throw new Error(`在 ${from}–${to} 里随机挑了 ${maxAttempts} 次都占不上端口`)
}
