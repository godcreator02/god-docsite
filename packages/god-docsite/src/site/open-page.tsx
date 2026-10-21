import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { appWindowParam, openPageChannel, parseOpenPageRequest } from '../core/open-page.js'
import { siteFeedClient } from './feed-client.js'

/** 标签页带着 appWindowParam 打开过就记在 sessionStorage：同一个标签页里换页、刷新都还在，别的标签页没有 */
const appWindowStorageKey = 'god-docsite:app-window'

/**
 * 托管方开的应用窗口跟着频道 open-page 换页：地址带 appWindowParam 的标签页记下自己是应用窗口、把参数从地址里去掉，
 * 之后托管方推来换页请求就转到那一页。只跟随开始听以后推的，连上时先收到的旧请求不算；别的标签页（VS Code 里开的、手动开的）不跟随
 */
export function OpenPageFollower() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (!params.has(appWindowParam)) return
    sessionStorage.setItem(appWindowStorageKey, '1')
    params.delete(appWindowParam)
    const search = params.toString()
    void navigate({ pathname: location.pathname, search: search === '' ? '' : `?${search}`, hash: location.hash }, { replace: true })
  }, [location, navigate])

  useEffect(() => {
    if (sessionStorage.getItem(appWindowStorageKey) === null) return
    const followSince = Date.now()
    return siteFeedClient().subscribe(openPageChannel, (data) => {
      const request = parseOpenPageRequest(data)
      if (request.at > followSince) void navigate(request.path)
    })
  }, [navigate])

  return null
}
