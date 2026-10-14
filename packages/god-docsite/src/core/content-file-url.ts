/**
 * 内容目录里的文件在网页上的地址：/api/content/ 加上它在内容目录里的相对路径。
 * HTML 页面原样展示，浏览器按文档地址解析相对引用，文件按原路径送出时页面里的相对图片、样式地址不用改写
 */
export const contentFileUrlPrefix = '/api/content/'

/** glob 给的路径（/content/guide/waveform.html）在网页上的地址（/api/content/guide/waveform.html） */
export function contentFileUrlOf(file: string, contentDir = '/content') {
  if (!file.startsWith(`${contentDir}/`)) throw new Error(`${file} 不在 ${contentDir} 下`)
  return `${contentFileUrlPrefix}${file.slice(contentDir.length + 1)}`
}
