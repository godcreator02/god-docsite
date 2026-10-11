// 包里的路由模块，写法照构建产物（不写 JSX）：loader 与组件都只用包自己的东西
import { jsx } from 'react/jsx-runtime'
import { useLoaderData } from 'react-router'

export async function loader() {
  return { message: '包里的路由模块：loader 运行了' }
}

export default function InPackage() {
  const { message } = useLoaderData()
  return jsx('p', { id: 'probe-in-package', children: message })
}
