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
from zipfile import ZipFile
from xml.etree import ElementTree as ET

import comtypes.client

ROOT = Path(__file__).resolve().parents[2]
DLL = Path(r'C:\Program Files (x86)\MathType\MathPage\64\MathPage.wll')


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
        doc.Content.Text = 'MathType API probe: see result.json for pass/fail.\r\r'
        point = doc.Content.End - 1
        # ClassType, FileName, LinkToFile, DisplayAsIcon, icon arguments, Range.
        missing = comtypes.automation.VARIANT.missing
        shape = doc.InlineShapes.AddOLEObject('Equation.DSMT4', missing, False, False,
                                             missing, missing, missing, doc.Range(point, point))
        record('inserted', progId=shape.OLEFormat.ProgID)
        shape.OLEFormat.DoVerb(0)
        obj = shape.OLEFormat.Object
        pointer = ct.cast(obj._comobj, ct.c_void_p)
        try:
            text = equation['latex']
            data = ct.create_unicode_buffer(text)
            written = lib.MTSetEqnFromLangStr(pointer, 1, data, len(text.encode('utf-16-le')) // 2)
            record('write-tex', returnCode=written)
            length = ct.c_long(0)
            got = lib.MTGetLangStrFromEqn(pointer, 1, None, ct.byref(length))
            record('read-length', returnCode=got, length=length.value)
            if got == 0 and 0 < length.value < 1_000_000:
                buffer = ct.create_string_buffer(length.value * 4 + 16)
                got = lib.MTGetLangStrFromEqn(pointer, 1, buffer, ct.byref(length))
                record('read-tex', returnCode=got, text=buffer.value.decode('utf-8', errors='replace'))
        finally:
            record('close-ole', returnCode=lib.MTCloseOleObject(1, pointer))
        path = out / 'ole-probe.docx'
        doc.SaveAs2(str(path), 16)
        doc.Close(0)
        doc = word.Documents.Open(str(path), False, True, False)
        record('reopened', objectCount=doc.InlineShapes.Count,
               progId=doc.InlineShapes.Item(1).OLEFormat.ProgID)
        doc.Close(0)
        with ZipFile(path) as archive:
            objects = ET.fromstring(archive.read('word/document.xml')).findall(
                './/{urn:schemas-microsoft-com:office:office}OLEObject')
            record('package-audit', objects=[dict(x.attrib) for x in objects],
                   embeddedFiles=[x for x in archive.namelist() if x.startswith('word/embeddings/')])
        # Even a successful write requires a separate modify/reopen and visual
        # check. This probe never declares the full MathType acceptance passed.
        report['status'] = ('blocked_by_expired_functionality' if full != 1 and mode == 3
                            else 'write_read_failed' if written != 0 or got != 0
                            else 'write_read_completed_further_edit_verification_required')
    except Exception:
        report['status'] = 'error'
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
    return 0 if report['status'].startswith('write_read_completed') else 2


if __name__ == '__main__':
    raise SystemExit(main())
