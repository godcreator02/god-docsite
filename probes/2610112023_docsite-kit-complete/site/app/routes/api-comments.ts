import { commentRequestResponse, commentSourceResponse } from '@godcreator/docsite-comments/server';
import { siteIdentity, sitePeople } from '@godcreator/docsite-identity/server';

/** 站点的完整 origin：宿主的可信配置（启动脚本按实际端口设置），authorizeWrite 按 it 核对请求的 Origin */
const siteOrigin = () => process.env.PROBE_SITE_ORIGIN ?? 'http://127.0.0.1:5460';

/** 编辑评论时取原文；发布站只读，不给 */
export async function loader({ request }: { request: Request }) {
  const commenter = siteIdentity().person;
  if (!commenter) return new Response('这个站只读', { status: 403 });
  return commentSourceResponse(request);
}

/**
 * 新建、回复、编辑、删除、解决、重新打开：谁在操作由身份包 authorizeWrite 核对（Origin、as），只改 comments/ 里的文件。
 * 评论文件的增删由开发服务自己的集合监听反映到页面上（Windows 下相对 glob base 的监听问题由
 * vite.config.ts 的 commentsGlobRootBase 插件处理），接口这里不碰集合配置
 */
export async function action({ request }: { request: Request }) {
  return commentRequestResponse(request, {
    commenter: siteIdentity().person,
    people: sitePeople(),
    pageUrls: ['/comments-demo', '/', '/second'],
    siteOrigin: siteOrigin(),
  })
}
