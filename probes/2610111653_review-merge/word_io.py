"""COM-only document writes for the bounded saved-review experiment."""
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import shutil
import time
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from merge import candidate,fingerprint,index,walk
from object_reader import inventory,load_api,get_tex
from word_session import word_application,opened_document,refresh,utf16_length

HERE=Path(__file__).resolve().parent
FIX=HERE/'fixture'
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def write(path,value):Path(path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def digest(path):return sha256(Path(path).read_bytes()).hexdigest()
def bookmark(identifier,suffix='_b'):return 'DR_'+sha256(identifier.encode()).hexdigest()[:28]+suffix
def plain(node):return node.get('type')=='paragraph' and all(set(n)<={'type','text'} and n['type']=='text' for n in node['content'])
def text(node):return ''.join(n['text'] for n in node['content'])
def new_id(context):return 'review-'+sha256(context.encode()).hexdigest()[:20]


def blocks(content):
    def visit(nodes,parent):
        for i,node in enumerate(nodes):
            if node['type']=='section':yield from visit(node['children'],node)
            else:yield node,parent,(nodes[i+1]['id'] if i+1<len(nodes) else None)
    yield from visit(content['blocks'],None)


def shape_for_figure(doc,identifier):
    caption=doc.Bookmarks.Item(bookmark(identifier,'_t')).Range.Paragraphs.First.Range
    previous=doc.Range(0,caption.Start).Paragraphs.Last.Range
    if previous.InlineShapes.Count!=1:raise ValueError('Figure caption has no unique preceding inline object')
    shape=previous.InlineShapes.Item(1)
    if shape.Type!=3:raise ValueError('Only ordinary inline pictures are supported')
    return shape


def figure_layout(doc,identifier):
    s=shape_for_figure(doc,identifier)
    return dict(widthMm=float(s.Width)*25.4/72,heightMm=float(s.Height)*25.4/72,
                lockAspectRatio=bool(s.LockAspectRatio))


def save(doc,word):
    doc.Save();deadline=time.monotonic()+30
    while word.BackgroundSavingStatus:
        if time.monotonic()>deadline:raise TimeoutError('Word background save did not finish')
        time.sleep(.02)


def collect(output,key_file):
    base=read(FIX/'content.json');layout=read(FIX/'layout.json');session=read(FIX/'session.json')
    for name,expected in read(HERE/'fixture-hashes.json').items():
        if digest(FIX/name)!=expected:raise ValueError('Frozen fixture changed: '+name)
    baseline=FIX/'baseline.docx';returned=FIX/'returned.docx'
    if digest(baseline)!=session['baselineSha256']:raise ValueError('Wrong baseline')
    with ZipFile(returned) as z:
        props=ET.fromstring(z.read('docProps/custom.xml'))
        if [''.join(n.itertext()) for n in props if n.get('name')=='DocReportReviewId']!=[session['batchId']]:
            raise ValueError('Returned review batch mismatch')
    normalized=output/'accepted-view.docx';shutil.copy2(returned,normalized)
    changes=[];coverage=[];paragraphBindings={};rowBindings={};comments=[];revision_count=0
    with word_application() as word:
        with opened_document(word,normalized) as doc:
            revision_count=int(doc.Revisions.Count)
            # Normalize ONLY this analysis copy; this is not an approval decision.
            if doc.ProtectionType!=-1:doc.Unprotect(read(key_file)['password'])
            doc.TrackRevisions=False
            for c in doc.Comments:comments.append(dict(text=c.Range.Text,scope=c.Scope.Text,author=c.Author))
            doc.AcceptAllRevisions();save(doc,word)
        with opened_document(word,baseline,True) as original:
            with opened_document(word,normalized,True) as doc:
                for node,parent,next_id in blocks(base):
                    kind=node['type'];identifier=node['id']
                    if kind=='paragraph':
                        old=original.Bookmarks.Item(bookmark(identifier)).Range.Text
                        current=doc.Bookmarks.Item(bookmark(identifier)).Range.Text
                        if not plain(node):
                            if old!=current:raise ValueError('Changed rich paragraph needs manual review: '+identifier)
                            coverage.append(dict(id=identifier,status='unchanged-rich-text'));continue
                        if old!=''.join(n['text'] for n in node['content'])+'\r':raise ValueError('Baseline paragraph does not match JSON')
                        if not current.endswith('\r') or '\x07' in current:raise ValueError('Unsupported paragraph boundary')
                        parts=current[:-1].split('\r')
                        if parts[0]!=text(node):
                            changes.append(candidate('replace',identifier,field='content',before=node['content'],
                                after=[dict(type='text',text=parts[0])],description='正文文字修改'))
                        if len(parts)>1:
                            if parent is None or any(not s for s in parts[1:]):raise ValueError('Unsupported new paragraph placement')
                            items=[dict(type='paragraph',id=new_id(session['batchId']+identifier+str(i)+t),
                                        content=[dict(type='text',text=t)]) for i,t in enumerate(parts[1:])]
                            changes.append(candidate('insert',parent['id'],field='children',afterId=identifier,
                                nextId=next_id,items=items,description='原段落后新增段落'))
                            paragraphBindings[identifier]=[n['id'] for n in items]
                        coverage.append(dict(id=identifier,status='plain-text-compared'))
                    elif kind=='table':
                        table=doc.Bookmarks.Item(bookmark(identifier)).Range.Tables.Item(1)
                        cols=len(node['columns']);old_rows=len(node['rows'])
                        if not table.Uniform or table.Columns.Count!=cols or table.Rows.Count<old_rows:
                            raise ValueError('Unsupported table shape')
                        for r,row in enumerate(node['rows'],1):
                            if len(row['cells'])!=cols:raise ValueError('Only simple rectangular rows supported')
                            for c,cell in enumerate(row['cells'],1):
                                if cell.get('colSpan',1)!=1 or cell.get('rowSpan',1)!=1 or len(cell['blocks'])!=1 or not plain(cell['blocks'][0]):
                                    raise ValueError('Only one plain paragraph per table cell supported')
                                p=cell['blocks'][0];value=table.Cell(r,c).Range.Text.removesuffix('\r\x07')
                                if value!=text(p):changes.append(candidate('replace',p['id'],field='content',before=p['content'],after=[dict(type='text',text=value)],description='单元格文字修改'))
                        added=[]
                        for r in range(old_rows+1,table.Rows.Count+1):
                            row_id=new_id(session['batchId']+identifier+'row'+str(r));cells=[]
                            for c in range(1,cols+1):
                                value=table.Cell(r,c).Range.Text.removesuffix('\r\x07')
                                if '\r' in value:raise ValueError('Multi-paragraph new cell needs manual review')
                                cells.append(dict(id=row_id+'-c'+str(c),blocks=[dict(type='paragraph',id=row_id+'-p'+str(c),content=[dict(type='text',text=value)])]))
                            added.append(dict(id=row_id,cells=cells))
                        if added:
                            changes.append(candidate('insert',identifier,field='rows',afterId=node['rows'][-1]['id'],nextId=None,items=added,description='表格尾部新增行'))
                            rowBindings[identifier]=[n['id'] for n in added]
                        coverage.append(dict(id=identifier,status='all-simple-cells-compared'))
                    elif kind=='figure':
                        b,a=figure_layout(original,identifier),figure_layout(doc,identifier)
                        if any(abs(b[k]-a[k])>.05 for k in ('widthMm','heightMm')) or b['lockAspectRatio']!=a['lockAspectRatio']:
                            changes.append(candidate('layout',identifier,before=layout.get(identifier,{}),after=a,description='图片显示尺寸修改'))
                        coverage.append(dict(id=identifier,status='caption-linked-inline-image-measured',baseline=b,returned=a))
    # Read only changed equations; keep prior evidence for unchanged payloads.
    bpack,apack=inventory(baseline,session['bookmarkToSourceId']),inventory(returned,session['bookmarkToSourceId'])
    comparisons=[];math_targets=[]
    for old in bpack['objects']:
        hits=[n for n in apack['objects'] if n['sourceIds']==old['sourceIds']]
        if len(hits)!=1 or len(old['sourceIds'])!=1:raise ValueError('Ambiguous equation identity')
        if old['sha256']!=hits[0]['sha256']:math_targets.append(old['sourceIds'][0])
        else:coverage.append(dict(id=old['sourceIds'][0],status='unchanged-OLE-payload'))
    if math_targets:
        import comtypes.client
        lib=load_api();word=None;initialized=False
        try:
            rc=lib.MTInitAPI(0,15)
            if rc<0:raise RuntimeError('MathType init failed')
            initialized=True;word=comtypes.client.CreateObject('Word.Application',dynamic=True)
            word.Visible,word.DisplayAlerts,word.AutomationSecurity=False,0,3
            doc=word.Documents.Open(str(normalized),False,True,False)
            for identifier in math_targets:
                shape=doc.Bookmarks.Item('MT_'+bookmark(identifier,'')).Range.InlineShapes.Item(1)
                value=get_tex(lib,shape).strip().strip('$')
                node=index(base)[identifier]
                comparisons.append(dict(id=identifier,before=node['latex'],after=value))
                if value!=node['latex']:changes.append(candidate('replace',identifier,field='latex',before=node['latex'],after=value,description='MathType 内部公式修改'))
            doc.Close(0)
        finally:
            if word is not None:
                for i in range(word.Documents.Count,0,-1):word.Documents.Item(i).Close(0)
                word.Quit(0)
            if initialized:lib.MTTermAPI()
    proposal=dict(format='review-merge-probe',baseContentHash=fingerprint(base),baseLayoutHash=fingerprint(layout),
        baselineDocxHash=digest(baseline),returnedDocxHash=digest(returned),changes=changes,comments=comments,
        revisionsObserved=revision_count,mathReadback=comparisons,coverage=coverage,
        bindings=dict(paragraphs=paragraphBindings,rows=rowBindings),status='pending-human-review',
        scope='Saved fixed ten-page review only. No pending edits in the live window. No general-purpose DOCX import.')
    write(output/'proposal.json',proposal)
    write(output/'decisions.pending.json',dict(proposalHash=fingerprint(proposal),choices={c['id']:'pending' for c in changes}))
    return proposal,normalized


def bind_insertions(doc,proposal,content):
    nodes=index(content)
    for old_id,new_ids in proposal['bindings']['paragraphs'].items():
        paras=doc.Bookmarks.Item(bookmark(old_id)).Range.Paragraphs
        spans=[(p.Range.Start,p.Range.End) for p in paras]
        if len(spans)!=len(new_ids)+1:raise ValueError('New paragraph locations are ambiguous')
        for identifier,(start,end) in zip([old_id]+new_ids,spans):
            if doc.Range(start,end).Text!=text(nodes[identifier])+'\r':raise ValueError('Paragraph binding text mismatch')
            doc.Bookmarks.Add(bookmark(identifier),doc.Range(start,end))
    for table_id,new_ids in proposal['bindings']['rows'].items():
        table=doc.Bookmarks.Item(bookmark(table_id)).Range.Tables.Item(1)
        rows=nodes[table_id]['rows']
        if table.Rows.Count!=len(rows):raise ValueError('Table binding row count mismatch')
        for r,row in enumerate(rows,1):
            if row['id'] not in new_ids:continue
            for c,cell in enumerate(row['cells'],1):
                p=cell['blocks'][0];rng=table.Cell(r,c).Range.Duplicate;rng.End-=1
                # Word's final cell marker is one Range unit but Text exposes
                # it as CR + BEL. Removing that unit removes both characters.
                if rng.Text!=text(p):raise ValueError('Cell binding text mismatch')
                doc.Bookmarks.Add(bookmark(p['id']),rng)


def patch_and_verify(accepted,output,proposal,review_content,merged,layout):
    """Reuse accepted return, then apply team-only plain-text differences."""
    target=output/'merged.docx';shutil.copy2(accepted,target);writes=[]
    with word_application() as word:
        with opened_document(word,target) as doc:
            bind_insertions(doc,proposal,review_content)
            old,new=index(review_content),index(merged)
            if set(old)!=set(new):raise ValueError('Team structural edits are outside this experiment')
            for identifier,node in new.items():
                if node==old[identifier] or not plain(node):continue
                if old[identifier].get('content')==node['content']:continue
                rng=doc.Bookmarks.Item(bookmark(identifier)).Range.Duplicate
                if rng.Text not in (text(old[identifier]),text(old[identifier])+'\r'):raise ValueError('Word/source drift before team patch')
                paragraph_mark=int(rng.Text.endswith('\r'))
                start=rng.Start;rng.End-=paragraph_mark;rng.Text=text(node)
                doc.Bookmarks.Add(bookmark(identifier),doc.Range(start,start+utf16_length(text(node))+paragraph_mark))
                writes.append(identifier)
            # Accepted image geometry already exists in this return and is preserved.
            refresh(doc);save(doc,word)
            doc.ExportAsFixedFormat(str(output/'merged.pdf'),17,False,0,0,1,1,0,True,True,1,True,True,False)
        with opened_document(word,target,True) as doc:
            checked=[]
            cell_paragraphs={p['id'] for n in walk(merged) if 'cells' in n for c in n['cells'] for p in c['blocks'] if plain(p)}
            for node in walk(merged):
                if plain(node):
                    actual=doc.Bookmarks.Item(bookmark(node['id'])).Range.Text
                    expected=text(node)+('' if node['id'] in cell_paragraphs else '\r')
                    if actual!=expected:raise ValueError('Saved paragraph mismatch: '+node['id'])
                    checked.append(node['id'])
            for node,_,_ in blocks(merged):
                if node['type']=='table':
                    t=doc.Bookmarks.Item(bookmark(node['id'])).Range.Tables.Item(1)
                    if t.Rows.Count!=len(node['rows']):raise ValueError('Saved table row count mismatch')
                if node['type']=='figure':
                    actual=figure_layout(doc,node['id']);expected=layout[node['id']]
                    if any(abs(actual[k]-expected[k])>.05 for k in ('widthMm','heightMm')):raise ValueError('Saved image geometry mismatch')
            state=dict(pages=int(doc.ComputeStatistics(2)),revisions=int(doc.Revisions.Count),comments=int(doc.Comments.Count),
                tables=int(doc.Tables.Count),inlineShapes=int(doc.InlineShapes.Count),omml=int(doc.OMaths.Count),
                plainParagraphsVerified=len(checked),teamParagraphsWritten=writes)
            if state['revisions'] or state['omml']:raise ValueError('Unexpected revisions or OMML')
    # No formula edits happened during team-only patch: compare every OLE payload.
    session=read(FIX/'session.json');b,a=inventory(accepted,session['bookmarkToSourceId']),inventory(target,session['bookmarkToSourceId'])
    if [n['sha256'] for n in b['objects']]!=[n['sha256'] for n in a['objects']]:raise ValueError('OLE payload unexpectedly changed')
    if [n['sha256'] for n in b['drawings']]!=[n['sha256'] for n in a['drawings']]:raise ValueError('Image bytes unexpectedly changed')
    state.update(status='passed_automation_visual_review_pending',allOlePayloadsPreserved=True,imageBytesPreserved=True,
        sourceDocxHash=digest(FIX/'returned.docx'),docxHash=digest(target),pdfHash=digest(output/'merged.pdf'))
    return state
