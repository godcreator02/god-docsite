import { avatarContentType, avatarMaxBytes, avatarSize } from '../core/avatar.js'

/** 转 webp 时依次试的质量：从高往低，第一张不超过 avatarMaxBytes 的就用它 */
const webpQualities = [0.92, 0.85, 0.75, 0.6, 0.45]

async function loadedImageOf(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode().catch((error: unknown) => {
      throw new Error(`浏览器打不开这张图（${file.name}）：${error instanceof Error ? error.message : String(error)}`)
    })
    if (image.naturalWidth === 0 || image.naturalHeight === 0) throw new Error(`这张图没有尺寸（${file.name}）：SVG 要写 width 与 height，或者 viewBox`)
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function blobOf(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob === null ? reject(new Error('画布转不出图片')) : resolve(blob)), avatarContentType, quality))
}

/**
 * 把选的图片做成服务端收的头像：居中裁成正方形、缩到 avatarSize 见方、转 webp（SVG 也在这里画成位图）。
 * 浏览器转不出 webp（toBlob 退回 png）或怎么压都超过 avatarMaxBytes 时报错
 */
export async function avatarWebpOf(file: File): Promise<Blob> {
  const image = await loadedImageOf(file)
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = avatarSize
  canvas.height = avatarSize
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('浏览器拿不到画布的 2d 上下文')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, avatarSize, avatarSize)
  for (const quality of webpQualities) {
    const blob = await blobOf(canvas, quality)
    if (blob.type !== avatarContentType) throw new Error(`这个浏览器不能把图片转成 webp（转出来是 ${blob.type}），换 Chrome 或 Edge 上传`)
    if (blob.size <= avatarMaxBytes) return blob
  }
  throw new Error(`压到最低质量还超过 ${avatarMaxBytes / 1024} KB，换一张简单些的图`)
}
