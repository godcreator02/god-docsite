"""Inspect table structure and changed MathType objects in captured review copies.

The read-only MathType getter ABI is taken from the already tested local bridge.
Only private copies are unprotected in memory; no document is saved or accepted.
"""
import argparse
import ctypes as ct
from hashlib import sha256
import json
from pathlib import Path
import posixpath
import shutil
from zipfile import ZipFile
from xml.etree import ElementTree as ET

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
O='{urn:schemas-microsoft-com:office:office}'
WP='{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}'
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
DLL=Path(r'C:\Program Files (x86)\MathType\MathPage\64\MathPage.wll')


def read(path):return json.loads(path.read_text(encoding='utf-8'))
def digest(path):return sha256(path.read_bytes()).hexdigest()
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def xml_value(node):
    if node is None:return None
    return dict(tag=node.tag,attributes=dict(sorted(node.attrib.items())),text=node.text or '',children=[xml_value(n) for n in node])


def drawing_layout(node):
    frame=next((n for n in node if n.tag in (WP+'inline',WP+'anchor')),None)
    if frame is None:return None
    extent=frame.find(WP+'extent')
    return dict(kind=frame.tag.removeprefix(WP),
        extentEmu={k:int(v) for k,v in extent.attrib.items()} if extent is not None else None,
        # Ignore editId/anchorId revision noise; keep actual placement settings.
        frameAttributes={k:v for k,v in frame.attrib.items() if not k.startswith('{')},
        placement=[xml_value(n) for n in frame if n.tag not in (WP+'extent',WP+'docPr',WP+'cNvGraphicFramePr',A+'graphic')],
        transforms=[xml_value(n) for n in frame.iter(A+'xfrm')],
        crops=[xml_value(n) for n in frame.iter(A+'srcRect')])


def compare_drawings(before,after):
    """Match this review's unique persisted drawing IDs; fail on ambiguity."""
    def indexed(items):
        result={}
        for n in items:
            key=n['drawingId']
            if key is None or key in result:raise RuntimeError('Ambiguous drawing identity; manual matching required')
            result[key]=n
        return result
    old,new=indexed(before),indexed(after);changes=[]
    for key in sorted(old.keys()|new.keys()):
        b,a=old.get(key),new.get(key)
        if b is None or a is None:
            changes.append(dict(drawingId=key,operation='insert' if b is None else 'delete',before=b,after=a));continue
        bytes_changed=b['sha256']!=a['sha256'];layout_changed=b['layout']!=a['layout']
        if not bytes_changed and not layout_changed:continue
        be=(b['layout'] or {}).get('extentEmu');ae=(a['layout'] or {}).get('extentEmu')
        aspect=bool(be and ae and be['cx']*ae['cy']!=ae['cx']*be['cy'])
        changes.append(dict(drawingId=key,operation='change',imageBytesChanged=bytes_changed,
            layoutChanged=layout_changed,sizeChanged=be!=ae,aspectRatioChanged=aspect,before=b,after=a))
    return changes


def inventory(path,mapping):
    with ZipFile(path) as z:
        root=ET.fromstring(z.read('word/document.xml'))
        rels={n.get('Id'):posixpath.normpath('word/'+n.get('Target')) for n in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
        active={};objects=[];tables=[];drawings=[]
        def source():
            return list(dict.fromkeys(mapping[n] for n in active.values() if n in mapping))
        def visit(node,revision=False):
            revision=revision or node.tag in (W+'ins',W+'del',W+'moveFrom',W+'moveTo')
            if node.tag==W+'bookmarkStart':active[node.get(W+'id')]=node.get(W+'name')
            if node.tag==W+'bookmarkEnd':active.pop(node.get(W+'id'),None)
            if node.tag==W+'object':
                ole=node.find(O+'OLEObject')
                if ole is not None:
                    part=rels[ole.get(R+'id')]
                    objects.append(dict(sourceIds=source(),bookmarks=list(active.values()),part=part,
                        progId=ole.get('ProgID'),sha256=sha256(z.read(part)).hexdigest(),insideRevision=revision))
            if node.tag==W+'drawing':
                props=node.find('.//'+WP+'docPr')
                for n in node.iter():
                    rid=n.get(R+'embed')
                    if rid and rid in rels:
                        part=rels[rid];drawings.append(dict(sourceIds=source(),part=part,sha256=sha256(z.read(part)).hexdigest(),
                            drawingId=props.get('id') if props is not None else None,
                            name=props.get('name') if props is not None else None,
                            layout=drawing_layout(node),insideRevision=revision))
            if node.tag==W+'tbl':
                rows=[]
                for tr in node.findall(W+'tr'):
                    rows.append(dict(inserted=tr.find(W+'trPr/'+W+'ins') is not None,
                        deleted=tr.find(W+'trPr/'+W+'del') is not None,
                        cells=[''.join(n.text or '' for n in tc.iter(W+'t')) for tc in tr.findall(W+'tc')]))
                tables.append(dict(sourceIds=source(),rows=rows))
            for child in node:visit(child,revision)
        visit(root)
        return dict(objects=objects,tables=tables,drawings=drawings)


def load_api():
    lib=ct.WinDLL(str(DLL))
    for name,args in {
        'MTInitAPI':[ct.c_short,ct.c_short], 'MTTermAPI':[],
        'MTGetLangStrFromEqn':[ct.c_void_p,ct.c_short,ct.c_void_p,ct.POINTER(ct.c_long)],
        'MTCloseOleObject':[ct.c_long,ct.c_void_p],
    }.items():
        fn=getattr(lib,name);fn.argtypes=args;fn.restype=ct.c_long
    return lib


def get_tex(lib,shape):
    shape.OLEFormat.DoVerb(0)
    obj=shape.OLEFormat.Object
    ptr=ct.cast(obj._comobj,ct.c_void_p)
    try:
        length=ct.c_long(0)
        rc=lib.MTGetLangStrFromEqn(ptr,1,None,ct.byref(length))
        if rc!=0 or not 0<length.value<1_000_000:raise RuntimeError(f'MathType length read: {rc}, {length.value}')
        buf=ct.create_string_buffer(length.value*4+16)
        rc=lib.MTGetLangStrFromEqn(ptr,1,buf,ct.byref(length))
        if rc!=0:raise RuntimeError(f'MathType text read: {rc}')
        return buf.value.decode('ascii')
    finally:
        rc=lib.MTCloseOleObject(1,ptr)
        if rc!=0:raise RuntimeError(f'MathType close: {rc}')


def main():
    parser=argparse.ArgumentParser(__doc__)
    parser.add_argument('--session',type=Path,required=True)
    parser.add_argument('--readback',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args();output=args.out.resolve()
    if output==ROOT/'out' or not output.is_relative_to(ROOT/'out'):raise ValueError('Use a fresh out/ child')
    output.mkdir(parents=True,exist_ok=False)
    session=read(args.session/'session.json');back=read(args.readback/'readback.json')
    baseline=Path(session['baselinePath']);returned=args.readback/'returned.docx'
    if digest(baseline)!=session['baselineSha256'] or digest(returned)!=back['returnedSha256']:
        raise RuntimeError('Snapshot hash mismatch')
    mapping=session['bookmarkToSourceId']
    before,after=inventory(baseline,mapping),inventory(returned,mapping)
    result=dict(status='in-progress',baseline=before,returned=after,formulaComparisons=[],
        drawingComparisons=compare_drawings(before['drawings'],after['drawings']),
        policy='Private copies only; unprotect in memory for MathType activation, no save, no revisions accepted/rejected, no JSON merge.')
    write(output/'details.json',result);shutil.copy2(__file__,output/'details.snapshot.py')
    pairs=[]
    for old in before['objects']:
        candidates=[n for n in after['objects'] if n['sourceIds']==old['sourceIds']]
        if len(candidates)!=1:raise RuntimeError('Ambiguous object identity; manual review required')
        new=candidates[0]
        if old['sha256']!=new['sha256']:
            bookmark=next(n for n in old['bookmarks'] if n.startswith('MT_') and n in new['bookmarks'])
            pairs.append((old,new,bookmark))
    lib=word=None;initialized=False
    try:
        if pairs:
            import comtypes.client
            lib=load_api();rc=lib.MTInitAPI(0,15)
            if rc<0:raise RuntimeError(f'MathType initialization: {rc}')
            initialized=True
            word=comtypes.client.CreateObject('Word.Application',dynamic=True)
            word.Visible,word.DisplayAlerts,word.AutomationSecurity=False,0,3
            # Password is never logged or copied to the evidence directory.
            password=read(args.session/session['keyFile'])['password']
            for tag,path in [('baseline',baseline),('returned',returned)]:
                target=output/(tag+'-analysis.docx');shutil.copy2(path,target)
                doc=word.Documents.Open(str(target),False,False,False)
                try:
                    if doc.ProtectionType!=-1:doc.Unprotect(password)
                    for old,new,bookmark in pairs:
                        shape=doc.Bookmarks.Item(bookmark).Range.InlineShapes.Item(1)
                        if shape.OLEFormat.ProgID!='Equation.DSMT4':raise RuntimeError('Unexpected OLE class')
                        result['formulaComparisons'].append(dict(snapshot=tag,sourceIds=old['sourceIds'],
                            bookmark=bookmark,tex=get_tex(lib,shape)))
                finally:doc.Close(0)
                if digest(target)!=digest(path):raise RuntimeError('Analysis copy was unexpectedly saved')
        result['status']='readback-complete-not-merged'
    except Exception as exc:
        result['status']='failed';result['error']=str(exc)
        raise
    finally:
        try:
            if word is not None:
                for i in range(word.Documents.Count,0,-1):word.Documents.Item(i).Close(0)
                word.Quit(0)
        finally:
            if initialized:result['terminateApiReturnCode']=lib.MTTermAPI()
            result['baselineSha256']=digest(baseline);result['returnedSha256']=digest(returned)
            write(output/'details.json',result)
            evidence=HERE/'evidence'/output.name;evidence.mkdir(parents=True,exist_ok=True)
            for name in ['details.json','details.snapshot.py']:shutil.copy2(output/name,evidence/name)
    print(json.dumps(dict(status=result['status'],output=str(output),formulaComparisons=result['formulaComparisons']),ensure_ascii=True))


if __name__=='__main__':main()
