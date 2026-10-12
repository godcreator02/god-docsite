import { useState } from 'react';
import { compiledAudit } from '../lib/audit-config.server';
import browserCollections from '../../.source/browser';
const browserA = browserCollections.auditA.createClientLoader({ component({default: Mdx}) { return <Mdx />; } });
const browserB = browserCollections.auditB.createClientLoader({ component({default: Mdx}) { return <Mdx />; } });
export function loader() { return compiledAudit(); }
export default function Audit({loaderData}: {loaderData: {a: string; b: string}}) {
  const [count,setCount] = useState(0);
  return <main><h1>Public config collection isolation</h1>
    <section data-probe="collection-a" dangerouslySetInnerHTML={{__html:loaderData.a}} />
    <section data-probe="collection-b" dangerouslySetInnerHTML={{__html:loaderData.b}} />
    <section data-probe="browser-a">{browserA.useContent('index.mdx')}</section>
    <section data-probe="browser-b">{browserB.useContent('index.mdx')}</section>
    <button onClick={()=>setCount(count+1)}>Audit hydrated: {count}</button>
  </main>;
}
