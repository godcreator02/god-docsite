// 只读诊断插件：记录 watcher 事件与 hotUpdate 调用，不改变任何行为。
// hotUpdate 返回 undefined：不接管更新列表、不增删模块、不 invalidate、不 reload。
// watcher 用 'all'：记录 add/change/unlink/addDir 等全部事件类型与文件路径。
export function diagnosticsPlugin(sink, { enforce = 'post' } = {}) {
  return {
    name: `probe:diagnostics-${enforce}`,
    enforce,
    configureServer(server) {
      server.watcher.on('all', (type, file) => {
        sink.push({ source: 'watcher', type, file: String(file).replaceAll('\\', '/') });
      });
    },
    hotUpdate(ctx) {
      sink.push({
        source: `hotUpdate:${enforce}`,
        type: ctx.type,
        file: String(ctx.file).replaceAll('\\', '/'),
        moduleIds: (ctx.modules ?? []).map((m) => m.id),
      });
      return undefined;
    },
  };
}
