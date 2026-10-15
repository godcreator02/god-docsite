import type { Route } from './+types/disk'
import { DiskPage } from '@godcreator/trajectory/site'
import { diskPageLoader } from '@godcreator/trajectory/site/server'
import { mdxComponents } from '@/lib/mdx-components'
import browserCollections from '../../../.source/browser'
import { trajectorySite } from './site.server'

export const loader = (args: Route.LoaderArgs) => diskPageLoader(args, trajectorySite)

export default function TrajectoryDisk() {
  return <DiskPage bodies={browserCollections.trajectory.raw} components={mdxComponents} />
}
