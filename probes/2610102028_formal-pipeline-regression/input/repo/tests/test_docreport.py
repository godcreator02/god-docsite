r"""Run with .venv\Scripts\python.exe -m unittest discover -s tests -v.

These tests do not start Word. The demo build separately exercises the real COM
and MathType pipeline, saved-object checks and report-specific numbering edits.
"""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from zipfile import ZipFile

from docreport.__main__ import load_report, reserve_output
from docreport.mathtype import mathtype_tex, validate_pending
from docreport.verify import package_state
from docreport.word import utf16_length, word_application


class ReportBoundaryTests(unittest.TestCase):
    def test_output_is_fresh_and_cannot_escape_out(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for target in (root / 'out', root / 'report', root / 'out/../report'):
                with self.assertRaises(ValueError):
                    reserve_output(target, root)
            path = reserve_output(root / 'out/first', root)
            marker = path / 'keep.txt'
            marker.write_text('original', encoding='utf-8')
            with self.assertRaises(FileExistsError):
                reserve_output(path, root)
            self.assertEqual(marker.read_text(encoding='utf-8'), 'original')

    def test_report_contract_accepts_independent_content_and_checks_template(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'layout.dotx').write_bytes(b'template is opened by Word later')
            payload = {'template': 'layout.dotx', 'uniqueReportProperty': [1, 2]}
            (root / 'content.json').write_text(json.dumps(payload), encoding='utf-8')
            (root / 'report.py').write_text('def build(doc, content, output): return []\ndef validate(doc, content): return {}\n', encoding='utf-8')
            directory, content, module, template = load_report(root)
            self.assertEqual(content, payload)
            self.assertEqual(template, (root / 'layout.dotx').resolve())
            self.assertEqual(module.build(None, content, None), [])
            payload['template'] = 'missing.dotx'
            (root / 'content.json').write_text(json.dumps(payload), encoding='utf-8')
            with self.assertRaises(ValueError):
                load_report(root)

    def test_word_session_cleans_only_its_owned_instance_on_failure(self):
        owned = MagicMock()
        owned.Documents.Count = 2
        with patch('win32com.client.DispatchEx', return_value=owned) as create:
            with self.assertRaisesRegex(RuntimeError, 'builder failed'):
                with word_application() as word:
                    self.assertIs(word, owned)
                    raise RuntimeError('builder failed')
        create.assert_called_once_with('Word.Application')
        self.assertEqual([call.args[0] for call in owned.Documents.Item.call_args_list], [2, 1])
        owned.Quit.assert_called_once_with(SaveChanges=0)

    def test_utf16_offsets_include_surrogate_pairs(self):
        self.assertEqual(utf16_length('公式😀x'), 5)


class MathTypeTests(unittest.TestCase):
    def test_aligned_adapter_preserves_rows_and_rejects_unverified_columns(self):
        self.assertEqual(mathtype_tex(r'\begin{aligned}a&=b\\c&=d\end{aligned}'),
                         r'\begin{array}{rl}a&=b\\c&=d\end{array}')
        self.assertEqual(mathtype_tex(r'\frac{a}{b}'), r'\frac{a}{b}')
        with self.assertRaises(ValueError):
            mathtype_tex(r'\begin{aligned}a&=b&c\end{aligned}')
        with self.assertRaises(ValueError):
            mathtype_tex('中文')

    def test_pending_rejects_ids_that_collide_after_word_bookmark_normalization(self):
        pending = [{'token': '@MATH0@', 'kind': 'math', 'equation': {'id': 'eq-a', 'latex': 'a'}},
                   {'token': '@MATH1@', 'kind': 'inline_math', 'equation': {'id': 'eq_a', 'latex': 'a'}}]
        with self.assertRaisesRegex(ValueError, 'distinct bookmark'):
            validate_pending(pending)
        pending[1]['equation']['id'] = 'second'
        validate_pending(pending)
        pending[1]['token'] = '@MATH0@'
        with self.assertRaisesRegex(ValueError, 'unique'):
            validate_pending(pending)

    def test_saved_package_requires_actual_embedded_payload(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'test.docx'

            def make(ole_type='Embed', payload=True, omml=False):
                xml = ('<doc xmlns:o="urn:schemas-microsoft-com:office:office" '
                       'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
                       'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">'
                       f'<o:OLEObject ProgID="Equation.DSMT4" Type="{ole_type}" r:id="rId1"/>'
                       + ('<m:oMath/>' if omml else '') + '</doc>')
                with ZipFile(path, 'w') as archive:
                    archive.writestr('word/document.xml', xml)
                    archive.writestr('word/_rels/document.xml.rels',
                                     '<Relationships><Relationship Id="rId1" Target="embeddings/eq.bin"/></Relationships>')
                    if payload:
                        archive.writestr('word/embeddings/eq.bin', b'payload')

            make()
            self.assertEqual(package_state(path, 1)['mathTypeObjects'], 1)
            for kwargs in ({'ole_type': 'Link'}, {'payload': False}, {'omml': True}):
                make(**kwargs)
                with self.assertRaises(RuntimeError):
                    package_state(path, 1)


if __name__ == '__main__':
    unittest.main()
