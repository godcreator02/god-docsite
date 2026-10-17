import ctypes,json,time,traceback
from pathlib import Path
import comtypes.client
from comtypes import automation
out=Path(__file__).parent
log=[]
def event(k,**v):
 rec=dict(event=k,**v);log.append(rec)
 print(json.dumps(rec,ensure_ascii=False),flush=True)
 (out/'api-probe.json').write_text(json.dumps(log,ensure_ascii=False,indent=2),encoding='utf-8')
lib=ctypes.WinDLL(r'C:\Program Files (x86)\MathType\MathPage\64\MathPage.wll')
for name,types in {
 'MTInitAPI':[ctypes.c_short,ctypes.c_short],
 'MTTermAPI':[],
 'MTSetEqnFromLangStr':[ctypes.c_void_p,ctypes.c_short,ctypes.c_void_p,ctypes.c_long],
 'MTGetLangStrFromEqn':[ctypes.c_void_p,ctypes.c_short,ctypes.c_void_p,ctypes.POINTER(ctypes.c_long)],
 'MTCloseOleObject':[ctypes.c_long,ctypes.c_void_p],
}.items():
 f=getattr(lib,name);f.argtypes=types;f.restype=ctypes.c_long
init=lib.MTInitAPI(0,15); event('api-init',rc=init)
w=None
try:
 w=comtypes.client.CreateObject('Word.Application',dynamic=True)
 w.Visible=False;w.DisplayAlerts=0;w.AutomationSecurity=3
 event('word-start')
 # Dynamic dispatch uses positional arguments; missing values are real COM variants.
 d=w.Documents.Open(str(out/'blank-ole.docx'),False,False,False)
 event('doc-open')
 s=d.InlineShapes.Item(1)
 event('prog-id',value=s.OLEFormat.ProgID)
 s.OLEFormat.DoVerb(0)
 event('activated')
 o=s.OLEFormat.Object
 p=ctypes.cast(o._comobj,ctypes.c_void_p)
 eq=json.loads((out.parents[1]/'fixtures/canonical.json').read_text(encoding='utf-8'))['equations'][1]['latex']
 buf=ctypes.create_unicode_buffer(eq)
 rc=lib.MTSetEqnFromLangStr(p,1,buf,len(eq));event('set-equation',rc=rc,latex=eq)
 size=ctypes.c_long(0)
 rc=lib.MTGetLangStrFromEqn(p,1,None,ctypes.byref(size));event('get-length',rc=rc,size=size.value)
 if 0<size.value<1000000:
  b=ctypes.create_string_buffer(size.value*4+16);n=ctypes.c_long(size.value)
  rc=lib.MTGetLangStrFromEqn(p,1,b,ctypes.byref(n));event('get-equation',rc=rc,size=n.value,text=b.value.decode('utf-8',errors='replace'),hex=b.raw[:100].hex())
 rc=lib.MTCloseOleObject(1,p);event('close-equation',rc=rc)
 d.SaveAs2(str(out/'api-formula.docx'),16)
 d.ExportAsFixedFormat(str(out/'api-formula.pdf'),17)
 event('saved')
 d.Close(0)
except Exception:
 event('exception',detail=traceback.format_exc())
finally:
 if w is not None: w.Quit(0)
 event('api-term',rc=lib.MTTermAPI())
