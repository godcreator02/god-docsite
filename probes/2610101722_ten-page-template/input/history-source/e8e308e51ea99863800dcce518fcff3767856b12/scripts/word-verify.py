"""Update, reopen, render and edit independent copies through native Word COM."""
import argparse
import json
from pathlib import Path
import time
from xml.etree import ElementTree
from zipfile import ZipFile
from word_com import word_application, opened_document, utf16_length

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ('word-com', 'pandoc', 'direct-docx')
NS = {'m': 'http://schemas.openxmlformats.org/officeDocument/2006/math'}


def refresh(doc):
    # Update again so a REF before its SEQ source receives the new value too.
    doc.Fields.Update()
    doc.Fields.Update()
    for toc in doc.TablesOfContents:
        toc.Update()
    doc.Repaginate()
    for toc in doc.TablesOfContents:
        toc.UpdatePageNumbers()


def math_structure(path):
    with ZipFile(path) as archive:
        root=ElementTree.fromstring(archive.read('word/document.xml'))
    return [{name:len(math.findall('.//m:'+name,NS)) for name in ('f','nary','m','eqArr','sSub','sSup','d')}
            for math in root.findall('.//m:oMath',NS)]


def project_checks(output):
    """Exercise editable Word behavior on separate copies of the delivered report."""
    output=output.resolve()
    final=output/'word-com.docx'
    checks={}
    with word_application() as word:
        with opened_document(word,final,True) as doc:
            doc.Repaginate()
            body_start=doc.Sections.Item(3).Range.Duplicate
            body_start.Collapse(1)
            checks['baseline']={
                'pages':doc.ComputeStatistics(2),'bodyStartsOnPage':body_start.Information(3),
                'bodyPages':doc.ComputeStatistics(2)-body_start.Information(3)+1,
                'math':doc.OMaths.Count,'tables':doc.Tables.Count,'figures':doc.InlineShapes.Count,
                'footnotes':doc.Footnotes.Count,'contentControls':doc.ContentControls.Count,
                'toc':doc.TablesOfContents.Count,'hyperlinks':doc.Hyperlinks.Count,
                'orientations':[s.PageSetup.Orientation for s in doc.Sections],
                'headingLevels':sorted({p.OutlineLevel for p in doc.Paragraphs if p.OutlineLevel<=3}),
                'headingNumbers':[p.Range.ListFormat.ListString for p in doc.Paragraphs if p.OutlineLevel==1]}
            original_math=[m.Range.Text for m in doc.OMaths]
            report=json.loads((ROOT/'fixtures/canonical.json').read_text(encoding='utf-8'))['projectReport']
            list_numbers=[]
            for section in report['sections']:
                for block in section['blocks']:
                    if block['type']=='list' and block['ordered']:
                        group=[]
                        for item in block['items']:
                            rng=doc.Content.Duplicate
                            assert rng.Find.Execute(FindText=item,Wrap=0)
                            group.append(rng.ListFormat.ListString)
                        assert group==[f'{i}.' for i in range(1,len(group)+1)],group
                        list_numbers.append(group)
            checks['baseline']['independentLists']=list_numbers
            long_table=doc.Bookmarks.Item('TblCasesData').Range.Tables.Item(1)
            checks['baseline']['longTableRows']=long_table.Rows.Count
            checks['baseline']['tablePages']=[long_table.Rows.Item(i).Range.Information(3) for i in (1,long_table.Rows.Count)]
        baseline=checks['baseline']
        assert baseline['pages']==12 and baseline['bodyPages']==10, baseline
        assert (baseline['math'],baseline['tables'],baseline['figures'],baseline['footnotes'],baseline['contentControls'],baseline['toc'])==(6,5,2,1,5,1)
        assert baseline['orientations']==[0,0,0,1,0]
        assert baseline['headingLevels']==[1,2,3] and baseline['headingNumbers']==[str(i) for i in range(1,10)]
        assert baseline['tablePages']==[9,10] and baseline['longTableRows']==41
        print('Baseline: 10 body pages, native headings/fields/controls/footnote/figures verified',flush=True)

        edited=output/'word-com.all-math-edit.docx'
        with opened_document(word,final) as doc:
            edits=[('0','1',True),('1','2',False),('𝑇','𝑆',True),('1','2',True),('0','1',True),('𝑣','𝑤',True)]
            for math,(old,new,forward) in zip(doc.OMaths,edits):
                rng=math.Range.Duplicate
                rng.Find.ClearFormatting()
                assert rng.Find.Execute(FindText=old,Forward=forward,Wrap=0), (old,math.Range.Text)
                rng.Text=new
            expected=[m.Range.Text for m in doc.OMaths]
            assert all(a!=b for a,b in zip(original_math,expected))
            doc.SaveAs2(str(edited),16,AddToRecentFiles=False)
        with opened_document(word,edited,True) as doc:
            assert [m.Range.Text for m in doc.OMaths]==expected
            doc.ExportAsFixedFormat(str(edited.with_suffix('.pdf')),17)
        assert math_structure(final)==math_structure(edited)
        checks['allMathEdit']={'passed':True,'before':original_math,'afterReopen':expected,'structurePreserved':True}
        print('All six native formulas edited, saved and reopened; structures preserved',flush=True)

        numbered=output/'word-com.numbering-check.docx'
        with opened_document(word,final) as doc:
            start=doc.OMaths.Item(2).Range.Paragraphs.Item(1).Range.Start
            text='\t@INSERTMATH@\t（@INSERTSEQ@）\r'
            doc.Range(start,start).InsertBefore(text)
            doc.Range(start,start+utf16_length(text)).Style=doc.Styles.Item('Equation')
            rng=doc.Content.Duplicate
            assert rng.Find.Execute(FindText='@INSERTMATH@',Wrap=0)
            start=rng.Start
            rng.Text='x=1'
            doc.OMaths.Add(doc.Range(start,start+3)).OMaths.Item(1).BuildUp()
            rng=doc.Content.Duplicate
            assert rng.Find.Execute(FindText='@INSERTSEQ@',Wrap=0)
            doc.Fields.Add(rng,-1,r'SEQ Equation \* ARABIC',True)
            refresh(doc)
            doc.SaveAs2(str(numbered),16,AddToRecentFiles=False)
        with opened_document(word,numbered,True) as doc:
            seq=[f.Result.Text for f in doc.Fields if f.Code.Text.strip().startswith('SEQ Equation')]
            refs=[f.Result.Text for f in doc.Fields if f.Code.Text.strip().startswith('REF EqFraction ')]
            assert seq==list('123456') and refs==['2','2'] and doc.OMaths.Count==7,(seq,refs)
            checks['insertFormula']={'passed':True,'equationSequence':seq,'fractionReferences':refs,'mathCount':doc.OMaths.Count}
            doc.ExportAsFixedFormat(str(numbered.with_suffix('.pdf')),17)
        print('Inserted formula: numbering and both existing references updated after reopen',flush=True)

        pagination=output/'word-com.pagination-check.docx'
        with opened_document(word,final) as doc:
            table=doc.Bookmarks.Item('TblCasesData').Range.Tables.Item(1)
            for i in range(41,56):
                row=table.Rows.Add()
                row.HeadingFormat=0
                row.AllowBreakAcrossPages=0
                row.Range.Style=doc.Styles.Item('Table Text')
                for column,value in enumerate([f'T{i:02d}','新增分页验证行','保留表头与完整单行','待实测'],1):
                    row.Cells.Item(column).Range.Text=value
            refresh(doc)
            doc.SaveAs2(str(pagination),16,AddToRecentFiles=False)
        with opened_document(word,pagination,True) as doc:
            table=doc.Tables.Item(3)
            pages=doc.ComputeStatistics(2)
            row_pages=[]
            for row in table.Rows:
                a,b=row.Range.Duplicate,row.Range.Duplicate
                a.Collapse(1)
                b.End-=1
                b.Collapse(0)
                assert a.Information(3)==b.Information(3), 'A table row split across pages'
                row_pages.append(a.Information(3))
            assert table.Rows.Count==56 and pages>baseline['pages'] and table.Rows.Item(1).HeadingFormat==-1
            checks['appendRows']={'passed':True,'addedRows':15,'rows':table.Rows.Count,'pages':pages,
                                  'tablePages':sorted(set(row_pages)),'repeatHeader':True,'allRowsUnsplit':True}
            doc.ExportAsFixedFormat(str(pagination.with_suffix('.pdf')),17)
        print('Added 15 rows: repagination and intact rows verified after reopen',flush=True)

        review=output/'word-com.review-check.docx'
        with opened_document(word,final) as doc:
            for cc in doc.ContentControls:
                if cc.Tag=='revision': cc.Range.Text='版本  R1（复核副本）'
            doc.TrackRevisions=True
            rng=doc.Content.Duplicate
            assert rng.Find.Execute(FindText='分阶段验证',Wrap=0)
            rng.Text='分阶段复核与验证'
            doc.TrackRevisions=False
            comment=doc.Comments.Add(rng,'复核示例：请确认阶段验收的责任人与证据位置。')
            comment.Author='项目复核'
            comment.Initial='QA'
            doc.SaveAs2(str(review),16,AddToRecentFiles=False)
        with opened_document(word,review,True) as doc:
            revisions=doc.Revisions.Count
            cc_value=next(cc.Range.Text for cc in doc.ContentControls if cc.Tag=='revision')
            assert revisions>0 and doc.Comments.Count==1 and 'R1' in cc_value
            checks['review']={'passed':True,'revisions':revisions,'comments':doc.Comments.Count,'revisionControl':cc_value}
        print('Cover control, tracked change and comment persisted after reopen',flush=True)
    (output/'project-verification.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
    return checks


def fraction_state(path):
    with ZipFile(path) as archive:
        root = ElementTree.fromstring(archive.read('word/document.xml'))
    maths = root.findall('.//m:oMath', NS)
    denominator = maths[1].find('.//m:den', NS)
    return len(maths), ''.join(denominator.itertext())


def verify(output, routes=ROUTES, reference_only=False):
    output = output.resolve()
    inputs = {route: output / ('pandoc.prepared.docx' if route == 'pandoc' else f'{route}.raw.docx') for route in routes}
    if not reference_only:
        for route, path in inputs.items():
            if not path.is_file():
                raise FileNotFoundError(path)
            for suffix in ['.docx', '.pdf', '.edit-check.docx']:
                if (output / (route + suffix)).exists():
                    raise FileExistsError(f'Use a fresh run: {output / (route + suffix)}')
    records = []
    with word_application() as word:
        if reference_only:
            with opened_document(word, ROOT / 'templates/sgcc-feasibility-2018-original.docx', True) as doc:
                doc.ExportAsFixedFormat(str(output / 'source-template.pdf'), 17)
            return
        for route, path in inputs.items():
            started = time.perf_counter()
            final = output / f'{route}.docx'
            edited = output / f'{route}.edit-check.docx'
            with opened_document(word, path) as doc:
                opened = time.perf_counter() - started
                doc.Fields.Update()
                for toc in doc.TablesOfContents:
                    toc.Update()
                doc.Repaginate()
                for toc in doc.TablesOfContents:
                    toc.UpdatePageNumbers()
                doc.SaveAs2(str(final), 16)
                saved = time.perf_counter() - started
            with opened_document(word, final) as doc:
                doc.Repaginate()
                doc.ExportAsFixedFormat(str(output / f'{route}.pdf'), 17)
                record = dict(route=route, controller='Python + pywin32', wordVersion=word.Version, wordBuild=word.Build,
                              openSeconds=opened, updateSaveSeconds=saved - opened,
                              reopenExportSeconds=time.perf_counter() - started - saved,
                              pages=doc.ComputeStatistics(2), equations=doc.OMaths.Count,
                              tables=doc.Tables.Count, rows=doc.Tables.Item(1).Rows.Count,
                              toc=doc.TablesOfContents.Count, fields=doc.Fields.Count,
                              formulaText=[math.Range.Text for math in doc.OMaths])
                rng = doc.OMaths.Item(2).Range.Duplicate
                rng.Find.ClearFormatting()
                if not rng.Find.Execute(FindText='1', Forward=False, Wrap=0):
                    raise RuntimeError('Denominator constant not found')
                rng.Text = '2'
                doc.SaveAs2(str(edited), 16)
            with opened_document(word, edited, True) as doc:
                record['editedFraction'] = doc.OMaths.Item(2).Range.Text
                reopened_math_count = doc.OMaths.Count
            # Check the denominator specifically; finding any '2' would also match s^2.
            before_count, before = fraction_state(final)
            after_count, after = fraction_state(edited)
            record['editCheck'] = (before_count == after_count == reopened_math_count == 6
                                   and before.endswith('1') and after == before[:-1] + '2')
            if not record['editCheck']:
                raise AssertionError(f'{route}: denominator edit did not survive reopen')
            records.append(record)
            (output / 'word-verification.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
            print(f'{route}: pages={record["pages"]}, equations={record["equations"]}, edit={record["editCheck"]}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output_directory', type=Path)
    parser.add_argument('--routes', choices=ROUTES, nargs='+', default=list(ROUTES))
    parser.add_argument('--reference-only', action='store_true')
    parser.add_argument('--project-report',action='store_true',help='Verify only the reusable-template project report and its edit copies')
    args = parser.parse_args()
    verify(args.output_directory, ['word-com'] if args.project_report else args.routes, args.reference_only)
    if args.project_report:
        project_checks(args.output_directory)
