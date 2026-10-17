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


def audit_pdf(path):
    """Catch the observed duplicate-formula failure independently of TeX metadata."""
    pages = PdfReader(path).pages
    text = '\n'.join(page.extract_text() or '' for page in pages)
    # Only the formula in this specific fixture contains an uppercase H.
    if len(pages) != 1 or text.count('H') != 1 or '?' in text:
        raise AssertionError(f'{path.name}: unexpected page count, duplicate formula or question marks')
    if '公式自动化验证' not in text:
        raise AssertionError(f'{path.name}: Chinese title was not preserved')
    return dict(pages=len(pages), formulaMarkerCount=text.count('H'), text=text)


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
        print(json.dumps(dict(event=event, **values), ensure_ascii=False), flush=True)

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
                            '验证内容：写入、读回、保存重开；将分母常数 1 改为 2 后再次保存重开。\r\r')
        doc.PageSetup.PageWidth, doc.PageSetup.PageHeight = 595.276, 841.89
        doc.PageSetup.TopMargin = doc.PageSetup.BottomMargin = 70.866
        doc.PageSetup.LeftMargin = doc.PageSetup.RightMargin = 70.866
        doc.Content.Font.Name = 'Times New Roman'
        doc.Content.Font.NameFarEast = '宋体'
        doc.Content.Font.Size = 12
        doc.Content.ParagraphFormat.SpaceAfter = 12
        doc.Paragraphs.Item(1).Range.Font.Size = 18
        doc.Paragraphs.Item(1).Range.Font.Bold = -1
        point = doc.Content.End - 1
        # ClassType, FileName, LinkToFile, DisplayAsIcon, icon arguments, Range.
        missing = comtypes.automation.VARIANT.missing
        shape = doc.InlineShapes.AddOLEObject('Equation.DSMT4', missing, False, False,
                                             missing, missing, missing, doc.Range(point, point))
        record('inserted', progId=shape.OLEFormat.ProgID)

        def equation_operation(shape, stage, expected, replacement=None):
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

        original = equation['latex']
        if original.count('+1}') != 1:
            raise ValueError('The fraction fixture no longer has one denominator constant +1.')
        edited = original.replace('+1}', '+2}', 1)
        equation_operation(shape, 'initial', original, original)
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
        edited_path = out / 'mathtype-edited.docx'
        doc.SaveAs2(str(edited_path), 16)
        doc.ExportAsFixedFormat(str(out / 'mathtype-edited.pdf'), 17)
        doc.Close(0)
        doc = word.Documents.Open(str(edited_path), False, True, False)
        equation_operation(doc.InlineShapes.Item(1), 'reopened-edited', edited)
        doc.Close(0)
        for saved in (path, edited_path):
            with ZipFile(saved) as archive:
                objects = ET.fromstring(archive.read('word/document.xml')).findall(
                    './/{urn:schemas-microsoft-com:office:office}OLEObject')
                binaries = {x: hashlib.sha256(archive.read(x)).hexdigest()
                            for x in archive.namelist() if x.startswith('word/embeddings/')}
                record('package-audit', file=saved.name, objects=[dict(x.attrib) for x in objects],
                       embeddedFiles=binaries)
                if len(objects) != 1 or objects[0].get('ProgID') != 'Equation.DSMT4' or len(binaries) != 1:
                    raise AssertionError('Saved DOCX lacks the expected MathType embedding')
            record('pdf-audit', file=saved.with_suffix('.pdf').name, **audit_pdf(saved.with_suffix('.pdf')))
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
