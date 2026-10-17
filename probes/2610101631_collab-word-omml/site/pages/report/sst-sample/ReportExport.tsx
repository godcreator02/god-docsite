import {useEffect,useState} from 'react'
type State={state:string;message?:string;stale?:boolean;checks?:{pages:number};docx?:string;pdf?:string}
export function ReportExport(){
  const [status,setStatus]=useState<State>({state:'idle'})
  useEffect(()=>{
    let active=true
    const refresh=()=>fetch('/__report/status').then(r=>r.json()).then(s=>{if(active)setStatus(s)}).catch(()=>{if(active)setStatus({state:'failed',message:'导出服务暂时不可用'})})
    refresh();const timer=setInterval(refresh,2500)
    return()=>{active=false;clearInterval(timer)}
  },[])
  async function run(){
    setStatus({state:'running'})
    try {const r=await fetch('/__report/export',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});setStatus(await r.json())}
    catch {setStatus({state:'failed',message:'导出启动失败，请查看本机服务'})}
  }
  return <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap',margin:'20px 0'}}>
    <button onClick={run} disabled={status.state==='running'} style={{border:'1px solid currentColor',borderRadius:6,padding:'8px 14px',cursor:'pointer'}}>
      {status.state==='running'?'Word 正在排版…':'导出 Word'}
    </button>
    {status.state==='ready'&&<><a href={status.docx}>下载 Word</a><a href={status.pdf} target="_blank" rel="noreferrer">查看 PDF</a><span>{status.checks?.pages} 页{status.stale?' · 正文已修改，请重新导出':''}</span></>}
    {status.state==='failed'&&<span role="alert">{status.message}</span>}
  </div>
}
