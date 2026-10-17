r"""Inline formulas written as Word text. Run with .venv\Scripts\python.exe -m unittest discover -s tests -v."""
from pathlib import Path
import tempfile
import unittest
import zipfile

from docreport.plain_math import INLINE_MATH_STYLE, clear_east_asian_hints


class EastAsianHintTests(unittest.TestCase):
    def test_hint_cleared_only_in_inline_math_runs(self):
        styles = ('<w:styles><w:style w:type="character" w:styleId="DRInlineMath">'
                  f'<w:name w:val="{INLINE_MATH_STYLE}"/></w:style></w:styles>')
        math = '<w:r><w:rPr><w:rStyle w:val="DRInlineMath"/><w:rFonts w:hint="eastAsia"/><w:i/></w:rPr><w:t>φ</w:t></w:r>'
        prose = '<w:r><w:rPr><w:rFonts w:hint="eastAsia"/></w:rPr><w:t>“引号”</w:t></w:r>'
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'draft.docx'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('word/styles.xml', styles)
                archive.writestr('word/document.xml', f'<w:document><w:body><w:p>{math}{prose}</w:p></w:body></w:document>')
            self.assertEqual(clear_east_asian_hints(path), 1)
            with zipfile.ZipFile(path) as archive:
                document = archive.read('word/document.xml').decode('utf8')
        self.assertIn('<w:rPr><w:rStyle w:val="DRInlineMath"/><w:i/></w:rPr><w:t>φ</w:t>', document)
        self.assertIn(prose, document)
