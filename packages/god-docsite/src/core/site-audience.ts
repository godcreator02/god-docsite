/** personal 只有自己在本机看（可以读工作台提供的本机目录）；shared 别人也会 clone 下来看（只能读站点目录里的文件） */
export const siteAudiences = ['personal', 'shared'] as const
export type SiteAudience = (typeof siteAudiences)[number]

export const isSiteAudience = (value: unknown): value is SiteAudience => typeof value === 'string' && (siteAudiences as readonly string[]).includes(value)
