import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import {createReadStream,existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
const root=fileURLToPath(new URL('../',import.meta.url))
const source=path.join(root,'site/pages/report/sst-sample/page.mdx')
const lastFile=path.join(root,'out/last-export.json')
let current={state:'idle'}
let output=null
if(existsSync(lastFile)){
  const saved=JSON.parse(readFileSync(lastFile,'utf8'))
  if(/^web-[a-zA-Z0-9-]+$/.test(saved.directory)){
    const dir=path.join(root,'out',saved.directory)
    if(existsSync(path.join(dir,'verification.json'))){output=dir;current={state:'ready',...JSON.parse(readFileSync(path.join(dir,'verification.json'),'utf8'))}}
  }
}
function status(){
  if(current.state!=='ready')return {state:current.state,message:current.message}
  const hash=createHash('sha256').update(readFileSync(source)).digest('hex')
  return {state:'ready',checks:current.checks,stale:hash!==current.sourceSha256,docx:'/__report/download.docx',pdf:'/__report/download.pdf'}
}
export function reportExport(){return {
  name:'local-report-export',
  configureServer(server){
    server.middlewares.use('/__report/',(req,res)=>{
      const route=(req.url??'').split('?')[0]
      const json=(code,value)=>{res.statusCode=code;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(value))}
      if(route==='/status'&&req.method==='GET')return json(200,status())
      if(/^\/download\.(docx|pdf)$/.test(route)&&req.method==='GET'){
        if(!output||current.state!=='ready')return json(404,{message:'尚无已完成的导出'})
        const ext=route.endsWith('docx')?'docx':'pdf'
        res.setHeader('content-type',ext==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        res.setHeader('content-disposition',`${ext==='pdf'?'inline':'attachment'}; filename="sst-collab-report.${ext}"`)
        res.setHeader('cache-control','no-store')
        return createReadStream(path.join(output,`sst-collab-report.${ext}`)).pipe(res)
      }
      if(route!=='/export'||req.method!=='POST')return json(404,{message:'没有这个操作'})
      if(req.headers.origin!=='http://127.0.0.1:4342')return json(403,{message:'请从本机试验页发起导出'})
      if(current.state==='running')return json(409,status())
      const directory='web-'+new Date().toISOString().replace(/[:.]/g,'-')
      output=path.join(root,'out',directory)
      current={state:'running'}
      const child=spawn(path.join(root,'.venv/Scripts/python.exe'),['-X','utf8',path.join(root,'routes/word-com/export_page.py'),output],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']})
      let log=''
      for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log+=chunk; if(log.length>100000)log=log.slice(-100000)})
      child.on('error',error=>{current={state:'failed',message:'未能启动 Word 导出，请检查本机环境'};server.config.logger.error(String(error))})
      child.on('close',code=>{
        mkdirSync(output,{recursive:true});writeFileSync(path.join(output,'export.log'),log)
        if(code!==0){current={state:'failed',message:'Word 导出失败，记录已保存在 out/'};return}
        try {current={state:'ready',...JSON.parse(readFileSync(path.join(output,'verification.json'),'utf8'))};writeFileSync(lastFile,JSON.stringify({directory}))}
        catch(error){current={state:'failed',message:'导出校验记录不完整'};server.config.logger.error(String(error))}
      })
      json(202,status())
    })
  }
}}
