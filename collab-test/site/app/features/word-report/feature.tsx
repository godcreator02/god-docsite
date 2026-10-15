import { FileText } from 'lucide-react'
import { reportHrefBase } from './href'

/** 侧栏横排里的「报告」入口：报告页（地址在它下面）上也高亮 */
export const sidebarLinks = [{ name: '报告', url: reportHrefBase, icon: <FileText />, order: 40 }]
