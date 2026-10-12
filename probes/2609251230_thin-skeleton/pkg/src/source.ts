import { loader, type Source } from 'fumadocs-core/source'

export function createSource<CollectionSource extends Source>(docs: { toFumadocsSource(): CollectionSource }) {
  return loader({ baseUrl: '/', source: docs.toFumadocsSource() })
}
