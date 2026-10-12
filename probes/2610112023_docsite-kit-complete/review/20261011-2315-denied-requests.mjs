import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const dir = path.resolve(import.meta.dirname, '../site/comments');
async function snapshot(root=dir) {
 const entries=await readdir(root,{withFileTypes:true}); const out={};
 for (const e of entries) { const p=path.join(root,e.name); if(e.isDirectory()) Object.assign(out,await snapshot(p)); else out[path.relative(dir,p)]=createHash('sha256').update(await readFile(p)).digest('hex'); }
 return out;
}
const before=await snapshot(); const origin='http://127.0.0.1:5460';
const readonly=process.argv.includes('--readonly');
const cases=readonly ? [{name:'readonly POST',expected:403,fields:{op:'create',body:'must not persist'}}] : [
 {name:'missing Origin', expected:403, noOrigin:true, fields:{op:'create',body:'must not persist'}},
 {name:'wrong Origin', expected:403, origin:'http://wrong.example',fields:{op:'create',body:'must not persist'}},
 ...[['human as','zk',403],['unknown as','missing-review-agent',400],['empty as','',400]].map(([name,as,expected])=>({name,expected,fields:{op:'create',body:'must not persist',as}})),
 {name:'File as',expected:400,fileAs:true,fields:{op:'create',body:'must not persist'}},
 ...['edit','delete'].map(op=>({name:'non-author '+op,expected:403,fields:{op,as:'zk-agent',thread:'2026-10-11-seed-welcome',file:'index.mdx',body:'must not persist'}})),
];
let failed=false;
for (const c of cases) {
 const body=new FormData(); for(const [k,v] of Object.entries(c.fields)) body.set(k,v);
 if(c.fileAs) body.set('as',new Blob(['agent']), 'as.txt');
 const response=await fetch(origin+'/api/comments',{method:'POST',headers:c.noOrigin?{}:{Origin:c.origin??origin},body,signal:AbortSignal.timeout(10000)});
 const text=await response.text(); console.log(JSON.stringify({name:c.name,status:response.status,expected:c.expected,body:text.slice(0,180)}));
 if(response.status!==c.expected) failed=true;
}
const after=await snapshot(); const unchanged=JSON.stringify(before)===JSON.stringify(after);
console.log(JSON.stringify({fileCount:Object.keys(after).length,unchanged})); if(!unchanged) failed=true;
process.exitCode=failed?1:0;

