import { auditA, auditB } from '../../.source/server';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
export function compiledAudit() {
  return {
    a: renderToStaticMarkup(createElement(auditA.docs[0].body)),
    b: renderToStaticMarkup(createElement(auditB.docs[0].body)),
  };
}
