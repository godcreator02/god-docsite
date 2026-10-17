"""EXPERIMENT ONLY: reuse a verified whole document and patch native COM ranges."""
from pathlib import Path
import copy
import ctypes as ct
from datetime import datetime
import hashlib
import json
import os
import shutil
import sys
import time
import traceback
from zipfile import ZipFile
from xml.etree import ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE/'engine'))
from docreport.__main__ import build, load_report, reserve_output, require_environment
from docreport.content import bookmark, walk
from docreport.compose import ContentComposer
from docreport.mathtype import DEFAULT_DLL, equation_bookmark, mathtype_tex, load_api, operate_equation
from docreport.verify import sha, package_state, content_state, native_text_state, document_state, pdf_state, abstract_state
from docreport.word import word_application, opened_document, refresh, utf16_length


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def equation_items(content):
    return [dict(sourceId=n['id'], equation=dict(id=bookmark(n['id']), latex=n['latex']),
                 kind='math' if n['type']=='equation' else 'inline_math')
            for n in walk(content) if n.get('type') in ('equation','math')]


def dependencies(directory):
    directory, content, module, template = load_report(Path(directory))
    files = {str(p.relative_to(HERE)): sha(p) for p in (HERE/'engine/docreport').glob('*.py')}
    files['template'] = sha(template)
    files['schema'] = sha(HERE/'schema.json')
    files['requirements'] = sha(HERE/'requirements.txt')
    files['report.py'] = sha(directory/'report.py') if (directory/'report.py').exists() else None
    files['assets'] = {str(p.relative_to(directory)): sha(p) for p in sorted(directory.rglob('*'))
                       if p.is_file() and 'assets' in p.relative_to(directory).parts}
    files['dll'] = sha(DEFAULT_DLL)
    # No Word launch for a no-op: capture installed binaries and font metadata.
    import winreg
    servers = {}
    for progid in ('Word.Application', 'Equation.DSMT4'):
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, progid+r'\CLSID') as k:
            clsid = winreg.QueryValueEx(k,None)[0]
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, 'CLSID\\'+clsid+r'\LocalServer32') as k:
            command = winreg.QueryValueEx(k,None)[0]
        import re
        match = re.match(r'^(?:"([^"]+)"|(.+?\.exe))(?:\s|$)', command, re.I)
        exe = Path(os.path.expandvars(match[1] or match[2]))
        servers[progid] = [str(exe), exe.stat().st_size, exe.stat().st_mtime_ns]
    files['servers'] = servers
    prefs = []
    def visit(path):
        try: key=winreg.OpenKey(winreg.HKEY_CURRENT_USER,path)
        except FileNotFoundError: return
        with key:
            children,values,_=winreg.QueryInfoKey(key)
            for i in range(values): prefs.append((path,winreg.EnumValue(key,i)))
            for i in range(children): visit(path+'\\'+winreg.EnumKey(key,i))
    for name in ('Colors','Config','Functions','Matrix','Sizes','Spacing','Styles'):
        visit(r'Software\Design Science\DSMT7'+'\\'+name)
    files['mathTypePreferencesHash']=hashlib.sha256(repr(sorted(prefs)).encode()).hexdigest()
    files['fonts'] = [(str(p),p.stat().st_size,p.stat().st_mtime_ns)
        for folder in (Path(os.environ['WINDIR'])/'Fonts', Path(os.environ['LOCALAPPDATA'])/'Microsoft/Windows/Fonts')
        if folder.exists() for p in sorted(folder.iterdir()) if p.is_file()]
    return json.loads(json.dumps(files))


def seal(directory, output):
    directory, content, _, _ = load_report(Path(directory))
    result = dict(version=1, content=content, dependencies=dependencies(directory),
                  outputs={name:sha(output/name) for name in ('report.docx','report.pdf')})
    write(output/'state.json',result)


def full(directory, output):
    started=time.perf_counter()
    destination=build(Path(directory),Path(output))
    seal(directory,destination.parent)
    shutil.copy2(HERE/'common.py',destination.parent/'common.snapshot.py')
    write(destination.parent/'experiment.json',dict(mode='full',seconds=time.perf_counter()-started))
    return destination.parent


def atomic(content):
    result=[]
    def visit(nodes):
        for node in nodes:
            if node['type']=='section':
                result.append((node['id'],{k:v for k,v in node.items() if k!='children'}))
                visit(node['children'])
            elif node['type']=='abstract':
                result.append((node['id'],{k:v for k,v in node.items() if k!='paragraphs'}))
                visit(node['paragraphs'])
            else:result.append((node['id'],node))
    visit(content['blocks'])
    return result


def plain_paragraph(node):
    return all(n['type']=='text' for n in node['content'])


def plan(old,new):
    if {k:v for k,v in old.items() if k!='blocks'} != {k:v for k,v in new.items() if k!='blocks'}:
        return dict(mode='full',reason='metadata-notes-or-references-changed')
    def structure(nodes):
        return [(n['type'],n['id'],structure(n.get('children',n.get('paragraphs',[]))))
                for n in nodes]
    before,after=atomic(old),atomic(new)
    if structure(old['blocks'])!=structure(new['blocks']):
        return dict(mode='full',reason='structure-insert-delete-or-move')
    changes=[]
    for (ident,a),(_,b) in zip(before,after):
        if a==b:continue
        kind=b['type']
        if kind=='paragraph' and a['type']==kind and plain_paragraph(a) and plain_paragraph(b):
            changes.append(dict(id=ident,kind=kind,node=b))
        elif kind=='equation' and {k:v for k,v in a.items() if k!='latex'}=={k:v for k,v in b.items() if k!='latex'}:
            changes.append(dict(id=ident,kind=kind,node=b))
        elif kind=='table' and a['type']==kind and a.get('caption')==b.get('caption') and a.get('numbered')==b.get('numbered'):
            cells=[c for row in b['rows'] for c in row['cells']]
            if any(c.get('rowSpan',1)!=1 or c.get('colSpan',1)!=1 or len(c['blocks'])!=1
                   or c['blocks'][0]['type']!='paragraph' or not plain_paragraph(c['blocks'][0]) for c in cells):
                return dict(mode='full',reason='complex-table',id=ident)
            changes.append(dict(id=ident,kind=kind,node=b))
        else:return dict(mode='full',reason='unsupported-node-change',id=ident)
    return dict(mode='patch' if changes else 'reuse',changes=changes)


def preflight(directory, baseline):
    state=read(baseline/'state.json')
    if any(not (baseline/name).exists() or sha(baseline/name)!=value for name,value in state['outputs'].items()):
        return dict(mode='full',reason='previous-output-modified')
    if dependencies(directory)!=state['dependencies']:
        return dict(mode='full',reason='template-assets-engine-or-environment-changed')
    return plan(state['content'],read(directory/'content.json'))


class LocalComposer(ContentComposer):
    def __init__(self,*args,position,**kwargs):
        super().__init__(*args,**kwargs)
        self.position=position

    def point(self):
        return super().point() if self.container is not None else self.doc.Range(self.position,self.position)

    def paragraph(self,text,style=None):
        result=super().paragraph(text,style)
        result.Font.Reset()
        if self.container is None:self.position=result.End
        return result


def patch_ranges(doc,content,directory,layout,changes):
    located=[]
    for change in changes:
        name=equation_bookmark(bookmark(change['id'])) if change['kind']=='equation' else bookmark(change['id'],'_b')
        if not doc.Bookmarks.Exists(name):return None,'missing-anchor:'+change['id']
        rng=doc.Bookmarks.Item(name).Range
        if change['kind']=='paragraph' and (rng.Tables.Count or rng.Paragraphs.Count!=1):
            return None,'ambiguous-paragraph-anchor:'+change['id']
        if change['kind']=='table' and (rng.Tables.Count!=1 or rng.Start!=rng.Tables.Item(1).Range.Start or rng.End!=rng.Tables.Item(1).Range.End):
            return None,'ambiguous-table-anchor:'+change['id']
        if change['kind']=='equation' and rng.InlineShapes.Count!=1:return None,'ambiguous-equation-anchor:'+change['id']
        located.append((rng.Start,name,change))
    pending=[]
    for _,name,change in sorted(located,reverse=True):
        rng=doc.Bookmarks.Item(name).Range
        ident,kind,node=change['id'],change['kind'],change['node']
        if kind=='equation':
            token='@MATH'+str(len(pending))+'@'
            rng.Text=token
            pending.append(dict(token=token,sourceId=ident,equation=dict(id=bookmark(ident),latex=node['latex']),kind='math'))
            continue
        start=rng.Start
        style=rng.Style.NameLocal if kind=='paragraph' else None
        fmt=rng.ParagraphFormat.Duplicate if kind=='paragraph' else None
        if kind=='table':
            rng.Tables.Item(1).Delete()
        else:
            rng.Delete()
        writer=LocalComposer(doc,content,directory,layout,position=start)
        if kind=='paragraph':
            result=writer.rich_paragraph(node['content'],style)
            result.ParagraphFormat=fmt
            writer.mark(ident,result,'_b')
        else:
            body=copy.deepcopy(node); body.pop('caption',None)
            writer.table_node(body,0)
    return pending,None


def verify_and_replace_math(path,content,pending,record):
    """Replace only changed objects; reopen and read back every formula."""
    import comtypes.client
    import comtypes.automation
    from docreport.word import find_text
    items=equation_items(content)
    if not items:return
    lib,word,initialized=load_api(DEFAULT_DLL),None,False
    try:
        rc=lib.MTInitAPI(0,15)
        if rc<0:raise RuntimeError('MathType init: '+str(rc))
        initialized=True
        if lib.MTIsFullFunctionality(0)!=1:raise RuntimeError('MathType functionality unavailable')
        word=comtypes.client.CreateObject('Word.Application',dynamic=True)
        word.Visible,word.DisplayAlerts,word.AutomationSecurity=False,0,3
        missing=comtypes.automation.VARIANT.missing
        if pending:
            doc=word.Documents.Open(str(path),False,False,False)
            for item in pending:
                target=find_text(doc,item['token']);target.Text=''
                shape=doc.InlineShapes.AddOLEObject('Equation.DSMT4',missing,False,False,missing,missing,missing,target)
                tex=mathtype_tex(item['equation']['latex'])
                operate_equation(lib,record,shape,item['sourceId'],tex,'$'+tex+'$')
                shape.AlternativeText='MathType '+item['equation']['id']
                doc.Bookmarks.Add(equation_bookmark(item['equation']['id']),shape.Range)
            doc.Save();doc.Close(0)
        doc=word.Documents.Open(str(path),False,True,False)
        for item in items:
            shape=doc.Bookmarks.Item(equation_bookmark(item['equation']['id'])).Range.InlineShapes.Item(1)
            operate_equation(lib,record,shape,'verify-'+item['sourceId'],mathtype_tex(item['equation']['latex']))
        doc.Close(0)
    finally:
        try:
            if word is not None:
                for i in range(word.Documents.Count,0,-1):word.Documents.Item(i).Close(0)
                word.Quit(0)
        finally:
            if initialized:lib.MTTermAPI()


def object_hashes(path):
    w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    r='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
    import posixpath
    with ZipFile(path) as z:
        root=ET.fromstring(z.read('word/document.xml'))
        rels={n.get('Id'):posixpath.normpath('word/'+n.get('Target')) for n in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
        result={}
        for obj in root.iter(w+'object'):
            ole=obj.find('{urn:schemas-microsoft-com:office:office}OLEObject')
            shape=obj.find('{urn:schemas-microsoft-com:vml}shape')
            if ole is None:continue
            label=shape.get('alt','') if shape is not None else ''
            result[label]=hashlib.sha256(z.read(rels[ole.get(r+'id')])).hexdigest()
        return result


def update(directory,baseline,output):
    require_environment()
    directory,baseline,output=Path(directory).resolve(),Path(baseline).resolve(),Path(output).resolve()
    started=time.perf_counter(); decision=preflight(directory,baseline)
    if decision['mode']=='full':
        result=full(directory,output)
        write(output/'decision.json',decision)
        return result
    output=reserve_output(output)
    shutil.copy2(HERE/'common.py',output/'common.snapshot.py')
    events=[]
    def record(event,**values):
        events.append(dict(event=event,seconds=round(time.perf_counter()-started,3),**values))
        write(output/'events.json',events)
    record('preflight',mode=decision['mode'])
    write(output/'decision.json',decision)
    shutil.copy2(baseline/'report.docx',output/'report.docx')
    shutil.copy2(directory/'content.json',output/'content.json')
    if decision['mode']=='reuse':
        shutil.copy2(baseline/'report.pdf',output/'report.pdf')
        seal(directory,output)
        write(output/'experiment.json',dict(mode='reuse',seconds=time.perf_counter()-started,
              wordLaunched=False,evidenceInheritedFrom=str(baseline),outputHashesEqual=read(output/'state.json')['outputs']==read(baseline/'state.json')['outputs']))
        return output
    _,content,module,_=load_report(directory)
    previous=object_hashes(baseline/'report.docx')
    try:
        with word_application() as word:
            with opened_document(word,output/'report.docx') as doc:
                pending,reason=patch_ranges(doc,content,directory,getattr(module,'LAYOUT',{}),decision['changes'])
                if reason:
                    write(output/'experiment.json',dict(mode='full-required',reason=reason,seconds=time.perf_counter()-started,originalUntouched=True))
                    return output
                doc.Save()
        record('local-write-saved',changedObjects=len(decision['changes']))
        verify_and_replace_math(output/'report.docx',content,pending,record)
        record('math-verified',created=len(pending),read=len(equation_items(content)))
        with word_application() as word:
            with opened_document(word,output/'report.docx') as doc:
                refresh(doc);doc.Save()
            record('fields-refreshed')
            with opened_document(word,output/'report.docx',True) as doc:
                generic=document_state(doc,len(equation_items(content)))
                abstract_state(doc,content)
                report_result=module.validate(doc,content)
                record('document-checked',result=generic,report=report_result)
                doc.ExportAsFixedFormat(str(output/'report.pdf'),17)
        record('pdf-exported')
        package_state(output/'report.docx',len(equation_items(content)))
        content_state(output/'report.docx',content,directory)
        native_text_state(output/'report.docx',content)
        pdf,texts=pdf_state(output/'report.pdf',generic['pages'])
        if hasattr(module,'validate_pdf'):module.validate_pdf(texts,content)
        current=object_hashes(output/'report.docx')
        changed={'MathType '+bookmark(c['id']) for c in decision['changes'] if c['kind']=='equation'}
        unchanged={k:v for k,v in previous.items() if k not in changed}
        retained=all(current.get(k)==v for k,v in unchanged.items())
        if not retained:raise RuntimeError('An unchanged embedded formula payload changed.')
        seal(directory,output)
        write(output/'experiment.json',dict(mode='patch',seconds=round(time.perf_counter()-started,3),
            changed=[dict(id=c['id'],kind=c['kind']) for c in decision['changes']],createdEquations=len(pending),
            unchangedEquationPayloads=len(unchanged),unchangedPayloadsEqual=retained,pdf=pdf,status='passed_automation_visual_review_pending'))
    except Exception:
        record('failed',traceback=traceback.format_exc())
        write(output/'experiment.json',dict(mode='patch',status='failed',seconds=time.perf_counter()-started))
        raise
    return output


def archive(output):
    target=HERE/'evidence'/output.name
    target.mkdir(parents=True,exist_ok=True)
    for path in output.rglob('*'):
        if not path.is_file() or path.suffix not in ('.json','.py','.txt'):continue
        if '__pycache__' in path.parts:continue
        dst=target/path.relative_to(output);dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(path,dst)
    write(target/'artifact-hashes.json',{str(p.relative_to(output)):sha(p) for p in output.rglob('*') if p.is_file() and p.suffix in ('.docx','.pdf')})
