import path from 'node:path'
import type { Route } from './+types/scan'
import { site } from '@/lib/site.server'
import { forgetParsedFiles } from '@/probe-platform/references.server'
import { scanSite, siteSections } from '@/probe-platform/site-sections.server'

export function loader({ request }: Route.LoaderArgs) {
  if (new URL(request.url).searchParams.get('cold') === '1') forgetParsedFiles()
  const references = scanSite()
  const relativeTo = path.dirname(site.dir)
  const shortened = (list: typeof references.references) => list.map((reference) => ({ ...reference, from: path.relative(relativeTo, reference.from) }))
  return Response.json({
    ms: Math.round(references.ms * 10) / 10,
    scannedFiles: references.scannedFiles,
    parsedFiles: references.parsedFiles,
    references: shortened(references.references),
    missing: shortened(references.missing),
    problems: references.problems.map((problem) => ({ ...problem, file: path.relative(relativeTo, problem.file) })),
    sections: siteSections(references),
  })
}
