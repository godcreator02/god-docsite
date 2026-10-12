import type { LoaderFunctionArgs } from 'react-router'
import { projectFileResponse } from '../server/repo-links.js'

/** repo: 链接指向的 PDF、图片、网页、视频交给浏览器 */
export function loader({ params }: LoaderFunctionArgs) {
  return projectFileResponse(params['*'] ?? '')
}
