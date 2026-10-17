"""Exercise invalidation decisions and one actual structural full rebuild."""
import argparse
from common import *


def main():
    p=argparse.ArgumentParser(__doc__);p.add_argument('--baseline',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    p.add_argument('--rebuild',action='store_true')
    p.add_argument('--deletion-only',action='store_true')
    args=p.parse_args(); output=reserve_output(args.out); baseline=args.baseline.resolve()
    if args.deletion_only:
        results=[]
        with word_application() as word:
            for mode in ('range-delete','table-delete'):
                with opened_document(word,baseline/'report.docx',True) as doc:
                    rng=doc.Bookmarks.Item(bookmark('tbl-values','_b')).Range
                    before=doc.Tables.Count; start=rng.Start
                    if mode=='range-delete':rng.Delete()
                    else:rng.Tables.Item(1).Delete()
                    after=doc.Tables.Count
                    doc.Tables.Add(doc.Range(start,start),3,2)
                    results.append(dict(mode=mode,before=before,afterDelete=after,afterAdd=doc.Tables.Count))
        write(output/'deletion.json',results);archive(output);print(json.dumps(results));return
    source=read(HERE/'fixture/content.json');results=[]
    for case in ('insert','delete','move','cross-parent-move','metadata','formula-placement','complex-table'):
        edited=copy.deepcopy(source); children=edited['blocks'][0]['children']
        if case=='insert':children.insert(1,dict(type='paragraph',id='p-added',content=[dict(type='text',text='新增段落用于验证结构变化后执行全量重建。')]))
        elif case=='delete':children.pop(1)
        elif case=='move':children[0],children[1]=children[1],children[0]
        elif case=='cross-parent-move':edited['blocks'][1]['children'].insert(0,children.pop())
        elif case=='metadata':edited['metadata']['revision']='R1'
        elif case=='formula-placement':children[3]['numbered']=False
        else:children[2]['rows'][1]['cells'][0]['blocks'].append(dict(type='paragraph',id='extra-cell-p',content=[dict(type='text',text='多段单元格')]))
        result=plan(source,edited)
        assert result['mode']=='full',case
        results.append(dict(case=case,decision=result,execution='planner-only'))
    changed=output/'changed-input';shutil.copytree(HERE/'fixture',changed,ignore=shutil.ignore_patterns('__pycache__'))
    with (changed/'template.dotx').open('ab') as f:f.write(b'PROBE-CHANGED')
    result=preflight(changed,baseline);assert result['mode']=='full'
    results.append(dict(case='template-change',decision=result,execution='preflight-only'))
    modified=output/'modified-output';shutil.copytree(baseline,modified)
    with (modified/'report.docx').open('ab') as f:f.write(b'PROBE-MANUAL-EDIT')
    result=preflight(HERE/'fixture',modified);assert result['reason']=='previous-output-modified'
    results.append(dict(case='manual-docx-change',decision=result,execution='preflight-only'))
    # Exercise a missing native anchor independently of the file-hash guard.
    with word_application() as word:
        with opened_document(word,baseline/'report.docx',True) as doc:
            doc.Bookmarks.Item(bookmark('p-edit','_b')).Delete()
            pending,reason=patch_ranges(doc,source,HERE/'fixture',{},[dict(id='p-edit',kind='paragraph',node=source['blocks'][0]['children'][0])])
            assert pending is None and reason=='missing-anchor:p-edit'
            results.append(dict(case='missing-anchor',decision=dict(mode='full-required',reason=reason),execution='native-unsaved-copy'))
    if args.rebuild:
        directory=output/'insert-input';shutil.copytree(HERE/'fixture',directory,ignore=shutil.ignore_patterns('__pycache__'))
        edited=copy.deepcopy(source)
        edited['blocks'][0]['children'].insert(1,dict(type='paragraph',id='p-added',content=[dict(type='text',text='新增段落用于验证结构变化后执行全量重建。')]))
        write(directory/'content.json',edited)
        result=update(directory,baseline,output/'insert-rebuilt')
        assert read(result/'decision.json')['mode']=='full'
        results.append(dict(case='insert-actual-rebuild',decision=read(result/'decision.json'),execution='passed-full-build',seconds=read(result/'experiment.json')['seconds']))
    write(output/'summary.json',dict(cases=results,passed=True,scope='Planner refusals are distinct from actual rebuild; only the insert case is rebuilt when requested.'))
    archive(output);print(json.dumps(dict(cases=len(results),passed=True)))


if __name__=='__main__':main()
