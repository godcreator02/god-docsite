r"""Inline TeX written as formatted text. Run with .venv\Scripts\python.exe -m unittest discover -s tests -v."""
from pathlib import Path
import tempfile
import unittest
import zipfile

from docreport.plain_math import INLINE_MATH_STYLE, clear_east_asian_hints, plain_runs


def shown(tex):
    """Runs as text: italic in /…/, subscript after _, superscript after ^."""
    runs = plain_runs(tex)
    if runs is None:
        return None
    return ''.join(('_' if r.script == 'sub' else '^' if r.script == 'sup' else '')
                   + (f'/{r.text}/' if r.italic else r.text) for r in runs)


class PlainRunsTests(unittest.TestCase):
    def test_letters_italic_digits_and_units_upright(self):
        self.assertEqual(shown(r'U_m = 12\,\mathrm{kV}'), '/U/_/m/ = 12 kV')
        self.assertEqual(shown('C_1'), '/C/_1')
        self.assertEqual(shown(r'L_{r1}'), '/L/_/r/_1')
        self.assertEqual(shown(r'V_{\mathrm{LL}}'), '/V/_LL')

    def test_greek_lowercase_italic_uppercase_upright(self):
        self.assertEqual(shown(r'\Delta E'), 'Δ/E/')
        self.assertEqual(shown(r'D=\varphi/\pi'), '/D/ = /φ///π/')

    def test_operators_get_spaces_and_signs_do_not(self):
        self.assertEqual(shown('2M+1'), '2/M/ + 1')
        self.assertEqual(shown(r'-\pi/2'), '−/π//2')
        self.assertEqual(shown(r'\varphi=\pm\pi/2'), '/φ/ = ±/π//2')
        self.assertEqual(shown(r'0\le D\le 0.5'), '0 ≤ /D/ ≤ 0.5')

    def test_function_names_upright_and_degree_on_the_baseline(self):
        self.assertEqual(shown(r'p_{cell}(t)=P_{cell}[1-\cos(2\omega t)]'),
                         '/p/_/cell/(/t/) = /P/_/cell/[1 − cos(2/ωt/)]')
        self.assertEqual(shown(r'V_{LL,\max}'), '/V/_/LL/_,max')
        self.assertEqual(shown(r'\varphi=45^\circ'), '/φ/ = 45°')

    def test_layout_structure_stays_with_mathtype(self):
        for tex in (r'1/\sqrt{2}', r'\frac{3}{2}e_d', r'\hat{V}_{ph}', r'\sum_k p_k', r'\left[1-x\right]',
                    r'i_d^*', r'I_{L,rms}^2', r'x_{a_b}', r'\partial i', r'a & b', r's \in \{-1, 0\}'):
            with self.subTest(tex=tex):
                self.assertIsNone(plain_runs(tex))


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
