/** JSON 里的对象：不是 null、不是数组。记录文件、gwb-collab 推给网站的数据、站点的 package.json 都用它查形状 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
