"""The website passes data; its report directory must never execute Python."""
import json
from pathlib import Path
import tempfile
import unittest

from docreport.__main__ import load_report


class DataOnlyTests(unittest.TestCase):
    def setUp(self):
        self.content = dict(format='docreport', schemaVersion=1, id='document',
                            metadata=dict(title='独立文档', language='zh-CN'),
                            blocks=[dict(type='paragraph', id='paragraph',
                                         content=[dict(type='text', text='正文')])])

    def write_content(self, root):
        (root / 'content.json').write_text(json.dumps(self.content), encoding='utf-8')

    def test_data_only_never_imports_report_module(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.write_content(root)
            (root / 'report.py').write_text("raise RuntimeError('must not execute')", encoding='utf-8')
            _, content, module, template = load_report(root, data_only=True)
            self.assertEqual(content, self.content)
            self.assertTrue(template.is_file())
            self.assertTrue(callable(module.build))
            with self.assertRaisesRegex(RuntimeError, 'must not execute'):
                load_report(root)

    def test_data_only_rejects_legacy_executable_report(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.content = dict(template='layout.dotx')
            self.write_content(root)
            with self.assertRaisesRegex(ValueError, 'compiled docreport'):
                load_report(root, data_only=True)

    def test_pure_layout_is_validated_before_com(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.write_content(root)
            layout = root / 'layout.json'
            layout.write_text(json.dumps({'paragraph': {'style': 'Normal'}}), encoding='utf-8')
            load_report(root, data_only=True, layout_path=layout)
            layout.write_text(json.dumps({'missing': {'style': 'Normal'}}), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Unknown layout ID'):
                load_report(root, data_only=True, layout_path=layout)
            with self.assertRaisesRegex(ValueError, '--layout requires'):
                load_report(root, layout_path=layout)


if __name__ == '__main__':
    unittest.main()
