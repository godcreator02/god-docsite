/**
 * 头像按文件名约定存放：站点根的 public/avatars/<人员 id>.webp，一人一个文件，people.json 不记。
 * public/ 下是静态文件，dev 与发布版都按 /avatars/<人员 id>.webp 取
 */
export const avatarsDirInSite = 'public/avatars'

/** 服务端只收这种图：边长 avatarSize 的正方形 webp，不超过 avatarMaxBytes。裁剪、缩放、转格式在浏览器里做 */
export const avatarSize = 128
export const avatarMaxBytes = 64 * 1024
export const avatarContentType = 'image/webp'

/** 上传（PUT，正文是图片本身）与删除（DELETE）本机身份的头像：身份功能的 template/ 写进站点的路由 */
export const avatarWriteUrl = '/identity/avatar'

/** 上传或删除成功时 avatarWriteUrl 回的 JSON：avatar 是写完以后的头像地址，删掉后为 null。被拒时回纯文本的原因 */
export type AvatarWriteResult = { avatar: string | null }

/** 头像文件相对站点根的路径 */
export function avatarFileInSite(personId: string): string {
  return `${avatarsDirInSite}/${personId}.webp`
}

/** 浏览器取头像的地址：v 是文件的修改时间，换了图地址就变，浏览器不拿缓存里的旧图 */
export function avatarUrlOf(personId: string, modifiedAtMs: number): string {
  return `/avatars/${personId}.webp?v=${Math.floor(modifiedAtMs)}`
}

/** 上传的头像不合格：status 是要回给浏览器的 HTTP 状态码，message 写明哪里不合格 */
export class AvatarRejected extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const textOf = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length))

/**
 * webp 的宽高，读文件头：RIFF 容器里第一块是 VP8（有损）、VP8L（无损）或 VP8X（扩展），三种各自记着宽高。
 * 不是 webp 时抛 AvatarRejected
 */
export function webpDimensionsOf(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 30 || textOf(bytes, 0, 4) !== 'RIFF' || textOf(bytes, 8, 4) !== 'WEBP') throw new AvatarRejected(400, '收到的不是 webp 文件：文件头不是 RIFF…WEBP')
  const chunk = textOf(bytes, 12, 4)
  if (chunk === 'VP8 ') {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) throw new AvatarRejected(400, 'webp 的 VP8 块缺了关键帧标记，读不出宽高')
    return { width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff, height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) throw new AvatarRejected(400, 'webp 的 VP8L 块缺了签名字节，读不出宽高')
    const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    return { width: (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1, height: (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1 }
  }
  throw new AvatarRejected(400, `webp 的第一块是 ${JSON.stringify(chunk)}，认得的只有 VP8、VP8L、VP8X`)
}

/** 核对上传的头像：类型是 image/webp、不超过 64 KB、宽高都是 128；不合格抛 AvatarRejected，不替它修正 */
export function assertAvatarImage(contentType: string | null, bytes: Uint8Array): void {
  if (contentType !== avatarContentType) throw new AvatarRejected(415, `头像只收 ${avatarContentType}：收到的 content-type 是 ${contentType ?? '空'}（裁剪、缩放、转格式在浏览器里做）`)
  if (bytes.length > avatarMaxBytes) throw new AvatarRejected(413, `头像不能超过 ${avatarMaxBytes / 1024} KB：收到 ${(bytes.length / 1024).toFixed(1)} KB`)
  const { width, height } = webpDimensionsOf(bytes)
  if (width !== avatarSize || height !== avatarSize) throw new AvatarRejected(400, `头像要是 ${avatarSize}×${avatarSize}：收到 ${width}×${height}`)
}
