import { searchServer } from '../lib/source.server'

export async function loader({ request }: { request: Request }) {
  return searchServer.GET(request)
}
