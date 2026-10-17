"""Saved-review -> pending proposal -> simulated merge -> reused Word/PDF."""
import argparse
from copy import deepcopy
from datetime import datetime,timezone
import json
from pathlib import Path
import re
import shutil
import time
import traceback
from jsonschema import Draft202012Validator
from pypdf import PdfReader
from merge import apply_review,fingerprint,index
from word_io import collect,patch_and_verify,read,write,digest,FIX,HERE

ROOT=HERE.parents[1]


def decisions(proposal,value='accept'):
    return dict(proposalHash=fingerprint(proposal),choices={c['id']:value for c in proposal['changes']},
                scope='SIMULATION ONLY; not a human approval or production merge')


def validate(content):
    Draft202012Validator(read(FIX/'schema.json')).validate(content);index(content)


def merge_scenarios(base,layout,proposal,merged):
    results=[];yes=decisions(proposal)
    def record(name,condition):
        if not condition:raise AssertionError(name)
        results.append(dict(case=name,status='passed'))
    again=apply_review(base,merged['content'],layout,merged['layout'],proposal,yes)
    record('repeat-is-idempotent',again['status']=='merged' and again['content']==merged['content'] and again['layout']==merged['layout'])
    conflict=deepcopy(base);index(conflict)['body-2-3']['content'][0]['text']+='【团队对同段的不同修改】'
    result=apply_review(base,conflict,layout,layout,proposal,yes)
    record('same-paragraph-conflict-blocks-output',result['status']=='needs-review' and result['content'] is None and any(c['reason']=='same-field-changed-by-both' for c in result['conflicts']))
    result=apply_review(base,base,layout,layout,proposal,decisions(proposal,'pending'))
    record('pending-decisions-block-output',result['status']=='needs-review' and result['content'] is None)
    result=apply_review(base,base,layout,layout,proposal,decisions(proposal,'reject'))
    record('reject-all-keeps-source',result['content']==base and result['layout']==layout)
    missing=deepcopy(base);children=index(missing)['chapter-one']['children'];children[:]=[n for n in children if n['id']!='p-stable']
    result=apply_review(base,missing,layout,layout,proposal,yes)
    record('missing-insertion-anchor-blocks-output',result['status']=='needs-review' and result['content'] is None)
    current=deepcopy(base);index(current)['cell-p-1-1']['content'][0]['text']='110 kW'
    result=apply_review(base,current,layout,layout,proposal,yes)
    record('team-cell-edit-survives-new-review-rows',result['status']=='merged' and index(result['content'])['cell-p-1-1']['content'][0]['text']=='110 kW' and len(index(result['content'])['tbl-values']['rows'])==6)
    stale=decisions(proposal);stale['proposalHash']='stale'
    try:apply_review(base,base,layout,layout,proposal,stale)
    except ValueError:record('stale-decisions-rejected',True)
    else:raise AssertionError('stale-decisions-rejected')
    return results


def main():
    parser=argparse.ArgumentParser(__doc__)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--key-file',type=Path,required=True)
    args=parser.parse_args();output=args.out.resolve()
    if output==ROOT/'out' or not output.is_relative_to(ROOT/'out'):raise ValueError('Use a fresh out/ child')
    output.mkdir(parents=True,exist_ok=False);started=time.perf_counter()
    # Archive code before execution so failed attempts remain reproducible.
    code=output/'code';code.mkdir()
    for p in HERE.glob('*.py'):shutil.copy2(p,code/p.name)
    try:
        proposal,accepted=collect(output,args.key_file)
        if len(proposal['changes'])!=5:raise AssertionError('This real fixture should yield five semantic/layout changes')
        base,layout=read(FIX/'content.json'),read(FIX/'layout.json')
        current=deepcopy(base)
        index(current)['p-edit']['content'][0]['text']+='【团队修改样例：补充验收条件。】'
        validate(current)
        write(output/'current-team.simulated.json',current)
        yes=decisions(proposal);write(output/'decisions.simulated.json',yes)
        reviewer=apply_review(base,base,layout,layout,proposal,yes)
        result=apply_review(base,current,layout,layout,proposal,yes)
        if reviewer['status']!='merged' or result['status']!='merged':raise AssertionError('Expected independent changes to merge')
        validate(result['content']);validate(reviewer['content'])
        report_dir=output/'merged-report';report_dir.mkdir();shutil.copytree(FIX/'assets',report_dir/'assets')
        write(report_dir/'content.json',result['content']);write(report_dir/'layout.json',result['layout'])
        write(output/'merge-result.json',{k:v for k,v in result.items() if k not in ('content','layout')})
        cases=merge_scenarios(base,layout,proposal,result);write(output/'merge-tests.json',cases)
        validation=patch_and_verify(accepted,report_dir,proposal,reviewer['content'],result['content'],result['layout'])
        write(output/'word-verification.json',validation)
        pdf=PdfReader(report_dir/'merged.pdf');all_text='\n'.join(p.extract_text() or '' for p in pdf.pages)
        write(output/'pdf-text.json',[dict(page=i,text=p.extract_text() or '') for i,p in enumerate(pdf.pages,1)])
        if len(pdf.pages)!=validation['pages']:raise AssertionError('Word/PDF page count mismatch')
        searchable=re.sub(r'\s+','',all_text)
        for needed in ['阿斯顿发啥的','123123','888方法发给','团队修改样例']:
            if needed not in searchable:raise AssertionError('Missing PDF text: '+needed)
        if 'COM修订测试' in searchable:raise AssertionError('Unsaved live test leaked into saved-input experiment')
        validation.update(pdfTextChecks='passed',visualReview='pending-user-review',elapsedSeconds=time.perf_counter()-started,
            status='passed_automation_visual_review_pending',simulation=True,mergeTestCount=len(cases))
        write(output/'verification.json',validation)
        lines=['# 审阅改动清单（待确认）','',
            '输入是上次已保存的十页返回稿。当前打开的 Word 中未保存的内容没有纳入。本清单未合入正式数据源。',
            '',f"识别 {len(proposal['changes'])} 项候选修改；原生 Word 修订为 {proposal['revisionsObserved']} 组；独立批注 {len(proposal['comments'])} 条。",'']
        for c in proposal['changes']:
            lines.extend([f"## {c['description']} — {c['targetId']}",'',f"变更编号：`{c['id']}`；决定：待确认。",''])
            if c['kind']=='insert':
                lines.extend([f"插入位置：`{c['afterId']}` 之后；新节点数：{len(c['items'])}。",''])
                if c['field']=='rows':
                    lines.extend(['| 新行 | 第一列 | 第二列 |','| --- | --- | --- |'])
                    for i,row in enumerate(c['items'],1):
                        values=[''.join(t['text'] for p in cell['blocks'] for t in p['content']) for cell in row['cells']]
                        lines.append(f'| {i} | {values[0]} | {values[1]} |')
                    lines.append('')
                else:
                    for n in c['items']:lines.extend(['> '+''.join(t['text'] for t in n['content']),'',f"新源 ID：`{n['id']}`。",''])
            else:lines.extend(['原值：','```json',json.dumps(c['before'],ensure_ascii=False,indent=2),'```','新值：','```json',json.dumps(c['after'],ensure_ascii=False,indent=2),'```',''])
        lines.extend(['## 独立模拟结果','',
            'out 中另做了一轮“假设采用全部候选”的实验，并模拟团队在 p-edit 另加一句文字。它不是你的真实批准；正式 JSON 与原 Word 均未改动。',
            f"三方合并场景 {len(cases)} 项通过。复用返回稿，在副本里接受修订、补齐新节点定位，仅写入团队另一段修改，未重生成全文。",
            f"保存重开、源内容、图像尺寸、对象哈希和 PDF 文本检查通过；PDF 为 {validation['pages']} 页，逐页显示待你检查。",'',
            '实验合并源：`merged-report/content.json`；图片尺寸：`merged-report/layout.json`；输出：`merged-report/merged.docx` 与 `merged-report/merged.pdf`。'])
        (output/'review.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
        write(output/'result.json',dict(status=validation['status'],proposalChanges=len(proposal['changes']),mergeTests=len(cases),
            artifacts={name:str(output/name) for name in ['proposal.json','decisions.pending.json','review.md','merged-report/content.json','merged-report/layout.json','merged-report/merged.docx','merged-report/merged.pdf']},
            scope='Real proposal remains pending. Merge and Word update are isolated simulations. No production files changed.'))
    except Exception as exc:
        write(output/'failure.json',dict(status='failed',error=str(exc),traceback=traceback.format_exc()))
        raise
    finally:
        evidence=HERE/'evidence'/output.name;evidence.mkdir(parents=True,exist_ok=False)
        for p in output.glob('*.json'):shutil.copy2(p,evidence/p.name)
        for p in output.glob('*.md'):shutil.copy2(p,evidence/p.name)
        shutil.copytree(code,evidence/'code')
        write(evidence/'artifact-hashes.json',{str(p.relative_to(output)):digest(p) for p in output.rglob('*') if p.is_file()})
    print(json.dumps(read(output/'result.json'),ensure_ascii=True))


if __name__=='__main__':main()
