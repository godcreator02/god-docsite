import { pageTreeLinksPlugin } from '@godcreator/god-docsite/react'
import { trajectoryHrefBase } from './href'

/** 侧栏根部末尾的「星轨盘」入口 */
export const pageTreePlugins = [pageTreeLinksPlugin([{ name: '星轨盘', url: trajectoryHrefBase }])]
