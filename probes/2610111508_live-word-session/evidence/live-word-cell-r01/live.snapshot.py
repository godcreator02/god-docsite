"""Measure first and three subsequent edits in one owned, open Word document."""
import argparse
from collections import defaultdict
import statistics
import win32process
from common import *


def save_finished(word,doc):
    doc.Save()
    deadline=time.perf_counter()+30
    while word.BackgroundSavingStatus:
        if time.perf_counter()>deadline:raise TimeoutError('Word background save did not finish')
        time.sleep(0.01)
    if not doc.Saved:raise RuntimeError('Word still reports unsaved changes')


def main():
    p=argparse.ArgumentParser(__doc__)
    p.add_argument('--baseline',type=Path)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--cases',nargs='+',choices=['character','cell','table','formula'],default=['character','table','formula'])
    args=p.parse_args();require_environment();output=reserve_output(args.out)
    shutil.copy2(Path(__file__),output/'live.snapshot.py')
    baseline=args.baseline.resolve() if args.baseline else full(HERE/'fixture',output/'baseline')
    manifest=read(baseline/'manifest.json')
    assert all(sha(baseline/name)==value for name,value in manifest['outputs'].items())
    recorded_content=[v for k,v in manifest['inputs'].items() if k.replace('\\','/').endswith('/fixture/content.json')]
    assert recorded_content==[sha(HERE/'fixture/content.json')]
    destination=output/'report.docx';started=time.perf_counter()
    shutil.copy2(baseline/'report.docx',destination)
    copied=time.perf_counter()-started
    _,content,module,template=load_report(HERE/'fixture')
    index={n['id']:n for n in walk(content) if 'id' in n}
    original_char=index['p-edit']['content'][0]['text']
    original_objects=object_hashes(destination)
    stable_key='MathType '+bookmark('eq-stable')
    trials=[];events=[];word=None;lib=None;initialized=False
    def record(event,**values):events.append(dict(event=event,**values))
    import comtypes.client
    import comtypes.automation
    try:
        opening=time.perf_counter()
        word=comtypes.client.CreateObject('Word.Application',dynamic=True)
        word.Visible,word.DisplayAlerts,word.AutomationSecurity=False,0,3
        doc=word.Documents.Open(str(destination),False,False,False)
        pid=win32process.GetWindowThreadProcessId(int(doc.ActiveWindow.Hwnd))[1]
        startup=time.perf_counter()-opening
        environment=dict(wordVersion=str(word.Version),wordBuild=str(word.Build),wordPid=pid,
                         backgroundPagination=bool(word.Options.Pagination),backgroundSave=bool(word.Options.BackgroundSave))
        write(output/'startup.json',dict(copyOnceSeconds=copied,launchAndOpenOnceSeconds=startup,environment=environment))
        missing=comtypes.automation.VARIANT.missing
        for kind in args.cases:
            for iteration in range(4):
                assert word.Documents.Count==1 and win32process.GetWindowThreadProcessId(int(doc.ActiveWindow.Hwnd))[1]==pid
                tick=time.perf_counter();api_init=0
                if kind=='character':
                    value=('那','此','该','这')[iteration]
                    rng=doc.Bookmarks.Item(bookmark('p-edit','_b')).Range
                    start,end=rng.Start,rng.End
                    doc.Range(start,start+1).Text=value
                    doc.Bookmarks.Add(bookmark('p-edit','_b'),doc.Range(start,end))
                    index['p-edit']['content'][0]['text']=value+original_char[1:]
                elif kind=='cell':
                    node=index['cell-p-1-1'];old=node['content'][0]['text'];value=f'{201+iteration} kW'
                    rng=doc.Bookmarks.Item(bookmark(node['id'],'_b')).Range
                    start,end=rng.Start,rng.End
                    doc.Range(start,start+utf16_length(old)).Text=value
                    doc.Bookmarks.Add(bookmark(node['id'],'_b'),doc.Range(start,end+utf16_length(value)-utf16_length(old)))
                    node['content'][0]['text']=value
                elif kind=='table':
                    index['cell-p-1-1']['content'][0]['text']=f'{101+iteration} kW'
                    pending,reason=patch_ranges(doc,content,HERE/'fixture',module.LAYOUT,
                        [dict(id='tbl-values',kind='table',node=index['tbl-values'])])
                    if reason or pending:raise RuntimeError(str(reason))
                else:
                    if not initialized:
                        init_start=time.perf_counter();lib=load_api(DEFAULT_DLL)
                        rc=lib.MTInitAPI(0,15)
                        if rc<0:raise RuntimeError('MathType init failed: '+str(rc))
                        initialized=True
                        if lib.MTIsFullFunctionality(0)!=1:raise RuntimeError('MathType is not editable')
                        api_init=time.perf_counter()-init_start
                    latex=(r'P=VI\eta',r'P=2VI',r'P=VI/2',r'P=VI\eta')[iteration]
                    ident=bookmark('eq-edit');name=equation_bookmark(ident)
                    rng=doc.Bookmarks.Item(name).Range;rng.Text=''
                    shape=doc.InlineShapes.AddOLEObject('Equation.DSMT4',missing,False,False,missing,missing,missing,rng)
                    operate_equation(lib,record,shape,'edit-eq-edit',latex,'$'+latex+'$')
                    shape.AlternativeText='MathType '+ident
                    doc.Bookmarks.Add(name,shape.Range)
                    index['eq-edit']['latex']=latex
                mutated=time.perf_counter()
                save_finished(word,doc);saved=time.perf_counter()
                refresh(doc);refreshed=time.perf_counter()
                save_finished(word,doc);saved_again=time.perf_counter()
                pdf=output/f'{kind}-{iteration}.pdf'
                doc.ExportAsFixedFormat(str(pdf),17);exported=time.perf_counter()
                item=dict(kind=kind,iteration=iteration,wordPid=pid,mathTypeInitSeconds=api_init,
                          editSeconds=mutated-tick,saveSeconds=saved-mutated,
                          refreshSeconds=refreshed-saved,saveAfterRefreshSeconds=saved_again-refreshed,
                          pdfSeconds=exported-saved_again,editToPdfSeconds=exported-tick)
                # Saved-package checks are measured separately from interactive work.
                package_state(destination,2);content_state(destination,content,HERE/'fixture')
                native_text_state(destination,content)
                objects=object_hashes(destination)
                assert len(objects)==2 and objects[stable_key]==original_objects[stable_key]
                if kind!='formula':assert objects==original_objects
                result,texts=pdf_state(pdf,10)
                assert result['pages']==10
                item.update(staticCheckSeconds=time.perf_counter()-exported,untouchedFormulaPayloadEqual=True,
                            newFormulaObjects=1 if kind=='formula' else 0,untouchedFormulaActivations=0,
                            pdfSha256=result['sha256'])
                trials.append(item);write(output/'trials.json',trials);write(output/'api-events.json',events)
                print(json.dumps(item),flush=True)
        shutil.copy2(pdf,output/'report.pdf')
        write(output/'content.json',content)
        accept_start=time.perf_counter();doc.Close(0)
        doc=word.Documents.Open(str(destination),False,True,False)
        final=document_state(doc,2);assert final['pages']==10
        if initialized:
            shape=doc.Bookmarks.Item(equation_bookmark(bookmark('eq-edit'))).Range.InlineShapes.Item(1)
            operate_equation(lib,record,shape,'final-reopened-eq-edit',index['eq-edit']['latex'])
        assert not any('eq-stable' in x.get('stage','') for x in events)
        doc.Close(0)
        acceptance=time.perf_counter()-accept_start
        fields=('editSeconds','saveSeconds','refreshSeconds','saveAfterRefreshSeconds','pdfSeconds','editToPdfSeconds','staticCheckSeconds')
        medians={kind:{key:statistics.median(r[key] for r in trials if r['kind']==kind) for key in fields}
                 for kind in args.cases}
        write(output/'summary.json',dict(status='passed_automation_visual_review_pending',pages=10,
            policy='One document copy and one private Word instance. First edit plus three subsequent edits per case. Word stays open for all edits. No unchanged formula activation. Mutation includes changed-formula write and readback when applicable. Save waits for the background queue. Final reopen acceptance is outside interactive timings.',
            startup=dict(copyOnceSeconds=copied,launchAndOpenOnceSeconds=startup),environment=environment,
            medians=medians,finalAcceptanceSeconds=acceptance,finalDocument=final,
            finalHashes={n:sha(output/n) for n in ('report.docx','report.pdf')},baselineUnchanged=all(sha(baseline/n)==v for n,v in manifest['outputs'].items())))
        write(output/'api-events.json',events)
    except Exception:
        write(output/'failure.json',dict(traceback=traceback.format_exc(),trialsCompleted=len(trials)))
        raise
    finally:
        try:
            if word is not None:
                try:
                    for i in range(word.Documents.Count,0,-1):word.Documents.Item(i).Close(0)
                finally:word.Quit(0)
        finally:
            if initialized:
                rc=lib.MTTermAPI();record('terminate-api',returnCode=rc)
            archive(output)


if __name__=='__main__':main()
