"""Probe Word COM + installed MathType API, without keyboard/mouse automation.

ABI source: MathType's installed 64-bit MathType Commands 2016.dotm,
Declarations64.bas, Declarations.bas and MTTeXToggle.bas. VBA Integer is
16-bit; Long is 32-bit; the equation setter receives UTF-16 code units.
"""
import argparse
import ctypes as ct
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import traceback
import winreg
from zipfile import ZipFile
from xml.etree import ElementTree as ET

import comtypes.client
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
DLL = Path(r'C:\Program Files (x86)\MathType\MathPage\64\MathPage.wll')


def audit_pdf(path, expected_numbers=('(1-1)',)):
    """Catch the observed duplicate-formula failure independently of TeX metadata."""
    pages = PdfReader(path).pages
    text = '\n'.join(page.extract_text() or '' for page in pages)
    # Only the formula in this specific fixture contains an uppercase H.
    if len(pages) != 1 or text.count('H') != len(expected_numbers) or '?' in text:
        raise AssertionError(f'{path.name}: unexpected page count, duplicate formula or question marks')
    if '公式自动化验证' not in text:
        raise AssertionError(f'{path.name}: Chinese title was not preserved')
    numbers = re.findall(r'\(\d+-\d+\)', re.sub(r'\s+', '', text))
    if numbers != list(expected_numbers):
        raise AssertionError(f'{path.name}: unexpected displayed numbers: {numbers}')
    return dict(pages=len(pages), formulaMarkerCount=text.count('H'), numbers=numbers, text=text)


def load_api():
    lib = ct.WinDLL(str(DLL))
    signatures = {
        'MTInitAPI': [ct.c_short, ct.c_short],
        'MTTermAPI': [],
        'MTIsFullFunctionality': [ct.c_short],  # False suppresses the license dialog.
        'MTGetAppFunctionality': [],
        'MTSetEqnFromLangStr': [ct.c_void_p, ct.c_short, ct.c_void_p, ct.c_long],
        'MTGetLangStrFromEqn': [ct.c_void_p, ct.c_short, ct.c_void_p, ct.POINTER(ct.c_long)],
        'MTCloseOleObject': [ct.c_long, ct.c_void_p],
    }
    for name, params in signatures.items():
        function = getattr(lib, name)
        function.argtypes, function.restype = params, ct.c_long

    return lib


def operate_equation(lib, record, shape, stage, expected, replacement=None):
    """Use a real OLE session, not a cached DOCX image, for every check."""
    shape.OLEFormat.DoVerb(0)
    obj = shape.OLEFormat.Object
    pointer = ct.cast(obj._comobj, ct.c_void_p)
    try:
        if replacement is not None:
            data = ct.create_unicode_buffer(replacement)
            rc = lib.MTSetEqnFromLangStr(pointer, 1, data,
                                       len(replacement.encode('utf-16-le')) // 2)
            record('write-tex', stage=stage, returnCode=rc, text=replacement)
            if rc != 0:
                raise RuntimeError(f'{stage}: MathType write failed: {rc}')
        length = ct.c_long(0)
        rc = lib.MTGetLangStrFromEqn(pointer, 1, None, ct.byref(length))
        record('read-length', stage=stage, returnCode=rc, length=length.value)
        if rc != 0 or not 0 < length.value < 1_000_000:
            raise RuntimeError(f'{stage}: invalid MathType read result')
        buffer = ct.create_string_buffer(length.value * 4 + 16)
        rc = lib.MTGetLangStrFromEqn(pointer, 1, buffer, ct.byref(length))
        text = buffer.value.decode('ascii')  # This fixture contains ASCII TeX only.
        matched = rc == 0 and text.strip().strip('$') == expected
        record('read-tex', stage=stage, returnCode=rc, text=text, matchesExpected=matched)
        if not matched:
            raise AssertionError(f'{stage}: equation content differs from expected')
    finally:
        rc = lib.MTCloseOleObject(1, pointer)
        record('close-ole', stage=stage, returnCode=rc)
        if rc != 0:
            raise RuntimeError(f'{stage}: MathType close failed: {rc}')


def mathtype_tex(latex):
    """Adapt the fixture's two-column aligned environment, preserving its body."""
    begin, end = r'\begin{aligned}', r'\end{aligned}'
    if latex.startswith(begin) and latex.endswith(end):
        body = latex[len(begin):-len(end)]
        if any(row.count('&') != 1 for row in body.split(r'\\')):
            raise ValueError('Only two-column aligned formulas have been verified with MathType 7.')
        return r'\begin{array}{rl}' + body + r'\end{array}'
    return latex


def audit_report_pdf(path, numbers, expected_pages):
    pages = PdfReader(path).pages
    texts = [p.extract_text() or '' for p in pages]
    assert len(pages)==expected_pages
    text = '\n'.join(texts)
    # This fixture contains no literal backslash. PDF extraction can separate a
    # red TeX backslash from its command name, so checking adjacent text misses it.
    if '\\' in text:
        raise AssertionError('PDF contains unparsed TeX commands; MathType API success is insufficient')
    for number in numbers:
        assert '('+number+')' in re.sub(r'\s+', '', text), number
    return texts


def render_report(draft, pending_math, report):
    """Fill a Word-generated report with real MathType OLE, including inline math."""
    from word_com import word_application, opened_document
    out = draft.parent
    destination = out / 'word-com.docx'
    if destination.exists():
        raise FileExistsError(destination)
    if sys.prefix == sys.base_prefix or struct.calcsize('P') != 8:
        raise RuntimeError('Use the repository 64-bit .venv Python.')
    evidence = dict(status='running', source='fixtures/canonical.json#projectReport',
                    python=sys.executable, events=[])

    def record(event, **values):
        evidence['events'].append(dict(event=event, **values))
        (out / 'mathtype-report-verification.json').write_text(
            json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')
        log_values = {key:value for key,value in values.items() if key!='pageText'}
        print(json.dumps(dict(event=event, **log_values), ensure_ascii=True), flush=True)

    lib, word, initialized = load_api(), None, False
    try:
        rc = lib.MTInitAPI(0, 15)
        if rc < 0:
            raise RuntimeError(f'MTInitAPI failed: {rc}')
        initialized = True
        full, mode = lib.MTIsFullFunctionality(0), lib.MTGetAppFunctionality()
        record('functionality', full=full, mode=mode)
        if full != 1:
            raise RuntimeError('MathType full functionality is required for this report.')
        word = comtypes.client.CreateObject('Word.Application', dynamic=True)
        word.Visible, word.DisplayAlerts, word.AutomationSecurity = False, 0, 3
        missing = comtypes.automation.VARIANT.missing
        doc = word.Documents.Open(str(draft), False, False, False)
        for item in pending_math:
            equation = item['equation']
            tex = mathtype_tex(equation['latex'])
            if tex != equation['latex']:
                record('tex-adaptation', id=equation['id'], sourceTex=equation['latex'],
                       mathTypeTex=tex, reason='MathType 7 rejects aligned; equivalent two-column array')
            target = doc.Content.Duplicate
            if not target.Find.Execute(item['token']):
                raise AssertionError(f'Missing equation placeholder: {item["token"]}')
            point = target.Start
            target.Text = ''
            shape = doc.InlineShapes.AddOLEObject('Equation.DSMT4', missing, False, False,
                                                 missing, missing, missing, doc.Range(point, point))
            operate_equation(lib, record, shape, equation['id'], tex, tex)
            shape.AlternativeText = 'MathType ' + equation['id']
            doc.Bookmarks.Add('MT_' + equation['id'].replace('-', '_'), shape.Range)
            record('equation-created', id=equation['id'], inline=item['kind']=='inline_math',
                   widthPt=shape.Width, heightPt=shape.Height)
        doc.SaveAs2(str(destination), 16)
        doc.Close(0)
        doc = word.Documents.Open(str(destination), False, True, False)
        if doc.OMaths.Count != 0:
            raise AssertionError('The MathType report still contains native OMML equations')
        for item in pending_math:
            eq = item['equation']
            shape = doc.Bookmarks.Item('MT_' + eq['id'].replace('-', '_')).Range.InlineShapes.Item(1)
            if shape.OLEFormat.ProgID != 'Equation.DSMT4':
                raise AssertionError(f'{eq["id"]}: wrong OLE class')
            operate_equation(lib, record, shape, 'reopened-' + eq['id'], mathtype_tex(eq['latex']))
        doc.Close(0)
        word.Quit(0)
        word = None

        def refresh(doc):
            doc.Fields.Update()
            doc.Fields.Update()
            for toc in doc.TablesOfContents:
                toc.Update()
            doc.Repaginate()
            for toc in doc.TablesOfContents:
                toc.UpdatePageNumbers()

        with word_application() as native_word:
            with opened_document(native_word, destination) as doc:
                refresh(doc)
                doc.Save()
            with opened_document(native_word, destination, True) as doc:
                refresh(doc)
                body = doc.Sections.Item(3).Range.Duplicate
                body.Collapse(1)
                baseline = dict(pages=doc.ComputeStatistics(2), bodyStart=body.Information(3),
                                ommlCount=doc.OMaths.Count, tables=doc.Tables.Count,
                                figures=sum(s.Type==3 for s in doc.InlineShapes),
                                mathTypeCount=sum(s.Type==1 for s in doc.InlineShapes),
                                footnotes=doc.Footnotes.Count, toc=doc.TablesOfContents.Count,
                                contentControls=doc.ContentControls.Count,
                                orientations=[s.PageSetup.Orientation for s in doc.Sections])
                baseline['bodyPages'] = baseline['pages'] - baseline['bodyStart'] + 1
                numbers = [doc.Bookmarks.Item(b['bookmark']).Range.Text
                           for section in report['sections'] for b in section['blocks'] if b['type']=='math']
                refs = [f.Result.Text for f in doc.Fields if f.Code.Text.strip().startswith('REF EqFraction ')]
                record('report-baseline', **baseline, numbers=numbers, fractionReferences=refs)
                assert baseline['ommlCount']==0 and baseline['mathTypeCount']==len(pending_math), baseline
                assert (baseline['tables'], baseline['figures'], baseline['footnotes'], baseline['toc'], baseline['contentControls'])==(5,2,1,1,5), baseline
                assert baseline['orientations']==[0,0,0,1,0], baseline
                assert numbers==[f'3-{i}' for i in range(1,6)] and refs==['3-1','3-1'], (numbers, refs)
                if re.search(r'@(MATH|FIELD|NUMSTART|NUMEND)', doc.Content.Text):
                    raise AssertionError('Unresolved formula or numbering placeholders remain')
                doc.ExportAsFixedFormat(str(destination.with_suffix('.pdf')), 17)

                # A temporary formula row tests that the bookmark includes both
                # chapter and sequence, and that existing REF fields follow it.
                first = doc.Bookmarks.Item('MT_eq_fraction').Range.Paragraphs.Item(1).Range.Start
                inserted = '\t编号验证\t(@CHECKCH@-@CHECKSEQ@)\r'
                doc.Range(first, first).InsertBefore(inserted)
                doc.Range(first, first+len(inserted)).Style = doc.Styles.Item('Equation')
                for marker, code in [('@CHECKCH@', r'STYLEREF 1 \s'),
                                     ('@CHECKSEQ@', r'SEQ Equation \* ARABIC \s 1')]:
                    target = doc.Content.Duplicate
                    assert target.Find.Execute(FindText=marker, Wrap=0)
                    doc.Fields.Add(target, -1, code, False)
                refresh(doc)
                refs = [f.Result.Text for f in doc.Fields if f.Code.Text.strip().startswith('REF EqFraction ')]
                assert refs==['3-2','3-2'], refs
                record('insert-numbering-check-unsaved', fractionReferences=refs)
        with ZipFile(destination) as archive:
            root = ET.fromstring(archive.read('word/document.xml'))
            objects = root.findall('.//{urn:schemas-microsoft-com:office:office}OLEObject')
            assert len(objects)==len(pending_math) and all(o.get('ProgID')=='Equation.DSMT4' for o in objects)
            assert not root.findall('.//{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath')
            record('package-audit', mathTypeObjects=len(objects), ommlCount=0,
                   docxSha256=hashlib.sha256(destination.read_bytes()).hexdigest())
        texts = audit_report_pdf(destination.with_suffix('.pdf'), numbers, baseline['pages'])
        record('pdf-text-audit', pages=len(texts), pageText=texts)
        evidence['status'] = 'passed_automation_visual_review_pending'
        return destination
    except Exception:
        evidence['status'] = 'error'
        record('exception', detail=traceback.format_exc())
        raise
    finally:
        if word is not None:
            word.Quit(0)
        if initialized:
            record('terminate-api', returnCode=lib.MTTermAPI())
        record('finished', status=evidence['status'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if sys.prefix == sys.base_prefix or struct.calcsize('P') != 8:
        raise RuntimeError('Use the repository 64-bit .venv Python.')
    out = (args.out or ROOT / 'out' / datetime.now().strftime('mathtype-%Y%m%d-%H%M%S')).resolve()
    if not out.is_relative_to((ROOT / 'out').resolve()):
        raise ValueError('Evidence must be in the repository out directory.')
    out.mkdir(parents=True, exist_ok=False)
    fixture = ROOT / 'fixtures/canonical.json'
    equation = next(x for x in json.loads(fixture.read_text(encoding='utf-8'))['equations']
                    if x['id'] == 'eq-fraction')
    report = dict(python=sys.executable, dll=str(DLL), input=equation,
                  fixtureSha256=hashlib.sha256(fixture.read_bytes()).hexdigest(),
                  status='running', events=[], visualReview='not_performed')
    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                        r'SYSTEM\CurrentControlSet\Control\Nls\CodePage') as key:
        report['systemAnsiCodePage'] = winreg.QueryValueEx(key, 'ACP')[0]

    def record(event, **values):
        report['events'].append(dict(event=event, **values))
        (out / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(dict(event=event, **values), ensure_ascii=True), flush=True)

    lib = load_api()

    word = None
    initialized = False
    full = mode = None
    try:
        init = lib.MTInitAPI(0, 15)
        record('init', returnCode=init)
        if init < 0:
            raise RuntimeError(f'MTInitAPI failed: {init}')
        initialized = True
        full = lib.MTIsFullFunctionality(0)
        mode = lib.MTGetAppFunctionality()
        record('functionality', full=full, mode=mode,
               modeName={0: 'fresh', 1: 'trial', 2: 'full', 3: 'expired', 4: 'cancelled'}.get(mode, 'unknown'))
        # CreateObject owns a new Word instance. Dynamic COM requires positional
        # arguments. comtypes exposes the IDispatch pointer without memory hacks.
        word = comtypes.client.CreateObject('Word.Application', dynamic=True)
        word.Visible, word.DisplayAlerts, word.AutomationSecurity = False, 0, 3
        record('word-started', version=word.Version)
        doc = word.Documents.Add()
        doc.Content.Text = ('MathType 公式自动化验证\r'
                            '数据来源：canonical.json / eq-fraction。\r'
                            '公式居中，编号右对齐；编号随章号及公式次序更新。\r'
                            '手工增删或移动公式后，按 Ctrl+A、F9 更新编号。\r')
        doc.PageSetup.PageWidth, doc.PageSetup.PageHeight = 595.276, 841.89
        doc.PageSetup.TopMargin = doc.PageSetup.BottomMargin = 70.866
        doc.PageSetup.LeftMargin = doc.PageSetup.RightMargin = 70.866
        doc.Content.Font.Name = 'Times New Roman'
        doc.Content.Font.NameFarEast = '宋体'
        doc.Content.Font.Size = 12
        doc.Content.ParagraphFormat.SpaceAfter = 12
        doc.Paragraphs.Item(1).Range.Font.Size = 18
        doc.Paragraphs.Item(1).Range.Font.Bold = -1
        missing = comtypes.automation.VARIANT.missing

        # Native Heading 1 list numbering is the chapter source for STYLEREF.
        heading = doc.Styles.Item(-2)
        heading.Font.Name, heading.Font.Color = 'Times New Roman', 0
        heading.Font.NameFarEast, heading.Font.Size, heading.Font.Bold = '黑体', 14, -1
        heading.NextParagraphStyle = doc.Styles.Item(-1)
        headings = doc.ListTemplates.Add(True, 'EquationChapters')
        level = headings.ListLevels.Item(1)
        level.NumberFormat, level.NumberStyle, level.StartAt = '%1', 0, 1
        level.NumberPosition, level.TextPosition, level.TrailingCharacter = 0, 0, 1
        level.LinkedStyle = heading.NameLocal
        heading.LinkToListTemplate(headings, 1)

        # The equation itself is centered on the text area; the number has a
        # separate right tab, so its width never shifts the formula off center.
        equation_style = doc.Styles.Add('Equation', 1)
        equation_style.BaseStyle = doc.Styles.Item(-1).NameLocal
        equation_style.Font.Name, equation_style.Font.NameFarEast = 'Times New Roman', '宋体'
        equation_style.Font.Size, equation_style.Font.Bold = 12, 0
        paragraph = equation_style.ParagraphFormat
        paragraph.Alignment = paragraph.LeftIndent = paragraph.RightIndent = paragraph.FirstLineIndent = 0
        paragraph.SpaceBefore = paragraph.SpaceAfter = 12
        paragraph.KeepTogether, paragraph.KeepWithNext, paragraph.LineSpacingRule = -1, 0, 0
        width = doc.PageSetup.PageWidth - doc.PageSetup.LeftMargin - doc.PageSetup.RightMargin
        paragraph.TabStops.ClearAll()
        paragraph.TabStops.Add(width / 2, 1, 0)  # wdAlignTabCenter
        paragraph.TabStops.Add(width, 2, 0)  # wdAlignTabRight

        def add_heading(text):
            start = doc.Content.End - 1
            doc.Range(start, start).InsertAfter(text + '\r')
            target = doc.Range(start, start + len(text.encode('utf-16-le')) // 2 + 1)
            target.Style = doc.Styles.Item(-2)
            target.Font.Reset()
            target.ParagraphFormat.Reset()

        def insert_equation(point):
            text = '\t\t(@CH@-@SEQ@)\r'
            doc.Range(point, point).InsertAfter(text)
            target = doc.Range(point, point + len(text))
            target.Style = doc.Styles.Item('Equation')
            target.Font.Reset()
            target.ParagraphFormat.Reset()
            # ClassType, FileName, LinkToFile, DisplayAsIcon, icon arguments, Range.
            shape = doc.InlineShapes.AddOLEObject('Equation.DSMT4', missing, False, False,
                                                 missing, missing, missing, doc.Range(point + 1, point + 1))
            for marker, code in [('@SEQ@', r'SEQ Equation \* ARABIC \s 1'),
                                 ('@CH@', r'STYLEREF 1 \s')]:
                target = shape.Range.Paragraphs.Item(1).Range.Duplicate
                if not target.Find.Execute(marker):
                    raise AssertionError(f'Equation field placeholder missing: {marker}')
                doc.Fields.Add(target, -1, code, False)
            record('inserted', progId=shape.OLEFormat.ProgID)
            return shape

        def audit_numbers(stage, expected):
            doc.Fields.Update()
            doc.Repaginate()
            rows = []
            for index in range(1, doc.InlineShapes.Count + 1):
                target = doc.InlineShapes.Item(index).Range.Paragraphs.Item(1).Range
                fields = []
                for field in target.Fields:
                    code = field.Code.Text.strip()
                    if code.startswith(('STYLEREF ', 'SEQ ')):
                        if field.Locked:
                            raise AssertionError('An equation numbering field is locked')
                        fields.append(dict(code=code, value=field.Result.Text.strip()))
                if len(fields) != 2:
                    raise AssertionError('Each equation must have two live numbering fields')
                number = f'({fields[0]["value"]}-{fields[1]["value"]})'
                tabs = target.ParagraphFormat.TabStops
                if tabs.Count != 2 or tabs.Item(1).Alignment != 1 or tabs.Item(2).Alignment != 2:
                    raise AssertionError('Equation must use separate center and right tabs')
                if abs(tabs.Item(1).Position - width / 2) > 0.1 or abs(tabs.Item(2).Position - width) > 0.1:
                    raise AssertionError('Equation tab positions do not match the text area')
                rows.append(dict(number=number, fields=fields))
            actual = [row['number'] for row in rows]
            record('numbering-audit', stage=stage, rows=rows, expected=expected)
            if actual != list(expected):
                raise AssertionError(f'{stage}: unexpected numbering {actual}, expected {expected}')

        add_heading('同章顺序编号')
        shape = insert_equation(doc.Content.End - 1)

        def equation_operation(shape, stage, expected, replacement=None):
            return operate_equation(lib, record, shape, stage, expected, replacement)

        original = equation['latex']
        if original.count('+1}') != 1:
            raise ValueError('The fraction fixture no longer has one denominator constant +1.')
        edited = original.replace('+1}', '+2}', 1)
        equation_operation(shape, 'initial', original, original)
        audit_numbers('initial', ['(1-1)'])
        path = out / 'mathtype-original.docx'
        doc.SaveAs2(str(path), 16)
        doc.ExportAsFixedFormat(str(out / 'mathtype-original.pdf'), 17)
        doc.Close(0)
        doc = word.Documents.Open(str(path), False, False, False)
        record('reopened', objectCount=doc.InlineShapes.Count,
               progId=doc.InlineShapes.Item(1).OLEFormat.ProgID)
        if doc.InlineShapes.Count != 1 or doc.InlineShapes.Item(1).OLEFormat.ProgID != 'Equation.DSMT4':
            raise AssertionError('Expected one persistent MathType OLE object')
        shape = doc.InlineShapes.Item(1)
        equation_operation(shape, 'reopened-original', original)
        # MTSetEqnFromLangStr appends inside a populated editor on this version.
        # Its TeX getter can return only the latest input, so a readback match
        # alone does not prove replacement. Build the new object at the same
        # start position, then delete the old object only after a successful write.
        old_shape = shape
        point = old_shape.Range.Start
        target = doc.Range(point, point)
        shape = doc.InlineShapes.AddOLEObject('Equation.DSMT4', missing, False, False,
                                             missing, missing, missing, target)
        equation_operation(shape, 'replace-existing', edited, edited)
        old_shape.Delete()
        record('replace-ole', mode='recreate-at-original-range', objectCount=doc.InlineShapes.Count)
        if doc.InlineShapes.Count != 1:
            raise AssertionError('Replacing the equation left extra OLE objects')
        audit_numbers('after-object-replacement', ['(1-1)'])
        edited_path = out / 'mathtype-edited.docx'
        doc.SaveAs2(str(edited_path), 16)
        doc.ExportAsFixedFormat(str(out / 'mathtype-edited.pdf'), 17)
        doc.Close(0)
        doc = word.Documents.Open(str(edited_path), False, True, False)
        equation_operation(doc.InlineShapes.Item(1), 'reopened-edited', edited)
        audit_numbers('reopened-edited', ['(1-1)'])
        doc.Close(0)

        doc = word.Documents.Open(str(edited_path), False, False, False)
        point = doc.InlineShapes.Item(1).Range.Paragraphs.Item(1).Range.Start
        shape = insert_equation(point)
        equation_operation(shape, 'insert-before-existing', original, original)
        audit_numbers('after-insertion', ['(1-1)', '(1-2)'])
        add_heading('换章重新计数')
        shape = insert_equation(doc.Content.End - 1)
        equation_operation(shape, 'new-chapter', original, original)
        expected_numbers = ['(1-1)', '(1-2)', '(2-1)']
        audit_numbers('new-chapter', expected_numbers)
        numbered_path = out / 'mathtype-numbered.docx'
        doc.SaveAs2(str(numbered_path), 16)
        doc.ExportAsFixedFormat(str(numbered_path.with_suffix('.pdf')), 17)
        doc.Close(0)
        doc = word.Documents.Open(str(numbered_path), False, True, False)
        audit_numbers('reopened-numbered', expected_numbers)
        for index, tex in enumerate([original, edited, original], 1):
            equation_operation(doc.InlineShapes.Item(index), f'reopened-numbered-{index}', tex)
        # Check deletion renumbers the surviving formula; discard this temporary
        # edit so the delivered sample retains the (1-2) and (2-1) examples.
        doc.InlineShapes.Item(1).Range.Paragraphs.Item(1).Range.Delete()
        audit_numbers('after-deletion-unsaved', ['(1-1)', '(2-1)'])
        doc.Close(0)
        for saved, numbers in [(path, ['(1-1)']), (edited_path, ['(1-1)']),
                               (numbered_path, expected_numbers)]:
            with ZipFile(saved) as archive:
                objects = ET.fromstring(archive.read('word/document.xml')).findall(
                    './/{urn:schemas-microsoft-com:office:office}OLEObject')
                binaries = {x: hashlib.sha256(archive.read(x)).hexdigest()
                            for x in archive.namelist() if x.startswith('word/embeddings/')}
                record('package-audit', file=saved.name, objects=[dict(x.attrib) for x in objects],
                       embeddedFiles=binaries)
                if (len(objects) != len(numbers) or len(binaries) != len(numbers)
                        or any(obj.get('ProgID') != 'Equation.DSMT4' for obj in objects)):
                    raise AssertionError('Saved DOCX lacks the expected MathType embedding')
            record('pdf-audit', file=saved.with_suffix('.pdf').name,
                   **audit_pdf(saved.with_suffix('.pdf'), numbers))
        report['status'] = 'passed_automation_visual_review_pending'
    except Exception:
        report['status'] = 'blocked_by_expired_functionality' if full != 1 and mode == 3 else 'error'
        record('exception', detail=traceback.format_exc())
    finally:
        if word is not None:
            try:
                word.Quit(0)
            except Exception as exc:
                record('word-cleanup-error', detail=repr(exc))
        if initialized:
            record('terminate-api', returnCode=lib.MTTermAPI())
        record('finished', status=report['status'])
    return 0 if report['status'] == 'passed_automation_visual_review_pending' else 2


if __name__ == '__main__':
    raise SystemExit(main())
