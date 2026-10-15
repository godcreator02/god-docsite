/** 开发服务的地址：平台的 vite 插件定下端口后写进这个环境变量，站点的服务端代码（同一个进程）按它认写入请求的来源 */
export const devOriginEnvName = 'DOCSITE_DEV_ORIGIN'

/** 浏览器打开的主机名：监听全部网卡、没写主机或只写了 --host 时是 localhost */
export function browserHostOf(host: string | boolean | undefined): string {
  return typeof host !== 'string' || host === '' || host === '0.0.0.0' || host === '::' ? 'localhost' : host
}
