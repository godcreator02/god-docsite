import { createPage } from '@godcreator/collab-site/page'
import { source } from '@/lib/source'
import { components } from '@/mdx-components'

const page = createPage({ source, components })

export default page.Page
export const generateStaticParams = page.generateStaticParams
