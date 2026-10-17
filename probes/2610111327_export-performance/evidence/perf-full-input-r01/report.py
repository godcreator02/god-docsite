"""Full-report layout and verification for the complete SST conversion."""
import re

from docreport.content import bookmark, walk
from docreport.mathtype import equation_bookmark
from docreport.word import utf16_length

# Word resamples large pictures at save time; this copy of the shared template
# adds <w:doNotAutoCompressPictures w:val="true"/> so the delivered package
# embeds the exact source PNG bytes. The public template stays untouched.
TEMPLATE = 'project-report-noimgcompress.dotx'

LAYOUT = {
    # Accepted ten-page baseline layout, kept unchanged.
    'table-30': {'widthsMm': [32, 128]},
    'table-44': {'widthsMm': [48, 52, 60]},
    'table-82': {'widthsMm': [32, 128]},
    'table-87': {'widthsMm': [56, 26, 26, 26, 26]},
    'sec-32': {'pageBreakBefore': True, 'orientation': 'portrait'},
    # Chapter 2 additions (portrait text area is 160 mm wide).
    'table-108': {'widthsMm': [30, 44, 44, 14, 28]},
    'table-152': {'widthsMm': [36, 30, 26, 32, 36]},
    'table-161': {'widthsMm': [24, 34, 22, 14, 66]},
    'table-166': {'widthsMm': [18, 18, 30, 34, 28, 32]},
    'table-180': {'widthsMm': [28, 64, 68]},
    # Chapters 5-11.
    'table-256': {'widthsMm': [30, 18, 18, 18, 14, 22, 20, 20]},
    'table-271': {'widthsMm': [34, 26, 24, 76]},
    'table-275': {'widthsMm': [42, 40, 44, 34]},
    'table-298': {'widthsMm': [22, 52, 86]},
    'table-306': {'widthsMm': [26, 28, 60, 46]},
    'table-319': {'widthsMm': [30, 52, 34, 44]},
    'table-330': {'widthsMm': [22, 22, 60, 56]},
    'table-335': {'widthsMm': [44, 18, 22, 76]},
    'table-344': {'widthsMm': [34, 34, 38, 54]},
    'table-355': {'widthsMm': [26, 134]},
    'table-367': {'widthsMm': [22, 26, 34, 16, 20, 42]},
    # Appendices.
    'table-390': {'widthsMm': [34, 26, 26, 74]},
    'table-421': {'widthsMm': [24, 136]},
    'table-452': {'widthsMm': [18, 34, 20, 14, 14, 34, 26]},
    'table-460': {'widthsMm': [30, 130]},
    'table-466': {'widthsMm': [36, 72, 52]},
    'table-470': {'widthsMm': [36, 72, 52]},
    'table-474': {'widthsMm': [36, 72, 52]},
    'table-479': {'widthsMm': [30, 26, 26, 22, 12, 16, 14, 14]},
    'table-484': {'widthsMm': [36, 72, 52]},
    'table-488': {'widthsMm': [36, 72, 52]},
    'table-493': {'widthsMm': [64, 26, 70]},
    'table-499': {'widthsMm': [12, 34, 114]},
    # Figures keep aspect ratio; tall plots are narrower.
    'fig-258': {'widthMm': 150}, 'fig-386': {'widthMm': 120},
    'fig-394': {'widthMm': 150}, 'fig-401': {'widthMm': 120},
    'fig-410': {'widthMm': 140}, 'fig-416': {'widthMm': 140},
    'fig-425': {'widthMm': 110}, 'fig-437': {'widthMm': 150},
    'fig-441': {'widthMm': 140}, 'fig-449': {'widthMm': 140},
}

EQUATION_NUMBERS = ['eq-phase-voltage', 'eq-cell-count', 'eq-cell-cost',
                    'eq-dab-power', 'eq-transformer-area-turns',
                    'eq-lcl-resonance', 'eq-modulation-index',
                    'eq-chb-modulation', 'eq-svpwm-conversion', 'eq-sps-power']
CHAPTER_NUMBERS = {
    'sec-32': '1', 'sec-79': '2', 'sec-173': '3', 'sec-184': '4',
    'sec-252': '5', 'sec-265': '6', 'sec-278': '7', 'sec-301': '8',
    'sec-332': '9', 'sec-353': '10', 'sec-357': '11',
    'sec-377': '附录 A', 'sec-423': '附录 B', 'sec-462': '附录 C',
    'sec-496': '附录 D',
}
SECTION_TITLES = {
    'sec-377': '调制度：概念、公式与计算方法',
    'sec-423': 'DAB 移相调制与 ZVS 分析',
    'sec-462': '设计参数核算表',
    'sec-496': '高频变压器技术条件书（定制输入，发往磁件厂）',
}


def _para_range(doc, node):
    name = bookmark(node['id'], '_b')
    if doc.Bookmarks.Exists(name):
        return doc.Bookmarks.Item(name).Range
    return None


def validate(doc, content):
    objects = list(walk(content))
    if doc.Tables.Count != 32:
        raise RuntimeError(f'Expected 32 tables, found {doc.Tables.Count}.')
    pictures = sum(1 for shape in doc.InlineShapes if shape.Type == 3)
    if pictures != 10:
        raise RuntimeError(f'Expected 10 embedded pictures, found {pictures}.')

    index = {x['id']: x for x in objects if 'id' in x}
    for ident, expected in CHAPTER_NUMBERS.items():
        rng = doc.Bookmarks.Item(bookmark(ident, '_t')).Range
        actual = rng.ListFormat.ListString.strip().rstrip('.').replace('附录 ', '附录 ')
        if actual.replace('附录 ', '附录') != expected.replace('附录 ', '附录'):
            raise RuntimeError(f'{ident}: chapter number {actual!r} != {expected!r}.')
    for ident, expected in SECTION_TITLES.items():
        text = doc.Bookmarks.Item(bookmark(ident, '_t')).Range.Text.rstrip('\r')
        if text != expected:
            raise RuntimeError(f'{ident}: title drifted: {text!r}.')

    equations = [x for x in objects if x.get('type') == 'equation']
    numbers = [doc.Bookmarks.Item(bookmark(x['id'], '_n')).Range.Text.strip()
               for x in equations]
    expected_pairs = ['1-1', '1-2', '1-3', '2-1', '2-2', '4-1',
                      'A-1', 'A-2', 'A-3', 'B-1']
    if sorted(numbers) != sorted(expected_pairs):
        raise RuntimeError(f'Equation numbering failed: {numbers}.')

    numbered_tables = [x for x in objects
                       if x.get('type') == 'table' and x.get('numbered')]
    table_numbers = sorted(
        int(doc.Bookmarks.Item(bookmark(x['id'], '_n')).Range.Text.strip())
        for x in numbered_tables)
    if table_numbers != list(range(1, 32)):
        raise RuntimeError(f'Table numbering failed: {table_numbers}.')
    figures = [x for x in objects if x.get('type') == 'figure']
    figure_numbers = sorted(
        int(doc.Bookmarks.Item(bookmark(x['id'], '_n')).Range.Text.strip())
        for x in figures)
    if figure_numbers != list(range(1, 11)):
        raise RuntimeError(f'Figure numbering failed: {figure_numbers}.')

    # Inspect the saved Word formatting in one package read.
    from pathlib import Path
    from docreport.verify import native_text_state
    native = native_text_state(Path(doc.FullName), content)
    checked, scripted = native['nativeTextRuns'], native['nativeScriptRuns']

    for eq in equations:
        shape = doc.Bookmarks.Item(equation_bookmark(bookmark(eq['id']))).Range.InlineShapes.Item(1)
        para = shape.Range.Paragraphs.Item(1).Range
        tabs = para.ParagraphFormat.TabStops
        if tabs.Count != 2 or tabs.Item(1).Alignment != 1 or tabs.Item(2).Alignment != 2:
            raise RuntimeError(f"Equation alignment failed: {eq['id']}")
        # Exactly two unlocked automatic fields: a chapter STYLEREF and either
        # the main-chapter sequence (SEQ Equation \s 1) or the per-appendix
        # sequence introduced for appendix roots (SEQ EquationAppendixA …).
        fields = [f for f in para.Fields
                  if f.Code.Text.strip().startswith(
                      ('STYLEREF ', 'SEQ Equation ', 'SEQ EquationAppendix'))]
        if len(fields) != 2 or any(f.Locked for f in fields):
            raise RuntimeError(f"Equation number must remain automatic: {eq['id']}")
        styles = sorted(re.match(r'STYLEREF (1|"Appendix Heading")',
                                 f.Code.Text.strip()).group(1) for f in fields
                        if f.Code.Text.strip().startswith('STYLEREF'))
        seqs = [f for f in fields if f.Code.Text.strip().startswith('SEQ ')]
        if len(styles) != 1 or len(seqs) != 1:
            raise RuntimeError(f"Equation field structure wrong: {eq['id']}")

    return dict(status='passed', tables=32, figures=10,
                numberedTables=31, equations=len(equations),
                equationNumbers=numbers,
                nativeTextRuns=checked, nativeScriptRuns=scripted,
                chaptersVerified=len(CHAPTER_NUMBERS),
                inlineMathTypeObjects=0, nativeWordEquations=0)


def validate_pdf(texts, content):
    joined = '\n'.join(texts)
    required = ['总体拓扑方案', 'DAB 模块设计（核心）', '调制策略',
                '系统控制架构（分层）', '效率分析与方案比较', '冗余设计与成本差异',
                '高压交流侧保护与共模干扰设计', '低压直流侧（800V）保护设计',
                '功率模块直流侧熔断器设计（重点）', '结论与推荐方案',
                'SST 产品化现状与主要厂商方案',
                '调制度：概念、公式与计算方法', 'DAB 移相调制与 ZVS 分析',
                '设计参数核算表', '高频变压器技术条件书（定制输入，发往磁件厂）',
                '97.41%', '2123Hz', '95kV', '56kW', '0.12T', '关键词：']
    missing = [x for x in required if x not in joined]
    if missing:
        raise RuntimeError(f'PDF text missing required content: {missing}.')
    import re
    stale = re.findall(r'[表图]\s*[0-9A-C]+-[0-9A-C]', joined)
    if stale:
        raise RuntimeError(f'Stale source numbering remains: {sorted(set(stale))[:8]}.')
    placeholders = [x for x in ('@MATH', '@FIELD', '@NUMSTART', '@LINK', '@NOTE',
                                '⟦', '⟪') if x in joined]
    if placeholders:
        raise RuntimeError(f'Unresolved placeholders in PDF: {placeholders}.')
    return dict(status='passed', pages=len(texts), requiredSnippets=len(required),
                staleNumbering=0)
