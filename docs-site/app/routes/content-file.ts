import { contentFileResponse } from '@godcreator/docsite-kit/server'
import type { Route } from './+types/content-file'

export async function loader({ params }: Route.LoaderArgs) {
  return contentFileResponse(params['*'] ?? '')
}
