/** 插件运行在 gwb 的 Electron 主进程里，electron 由宿主提供；本包只声明用到的几样，不为它装整个 electron 包 */
declare module 'electron' {
  export const shell: { openExternal(url: string): Promise<void> }
}
