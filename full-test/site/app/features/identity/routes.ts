import { relative, type RouteConfig } from '@react-router/dev/routes'

const { route } = relative(import.meta.dirname)

/** 头像写入：地址与 @godcreator/identity 的 avatarWriteUrl 一致，侧栏底部身份标记的头像面板往这里 PUT / DELETE */
export default [route('identity/avatar', './avatar.ts')] satisfies RouteConfig
