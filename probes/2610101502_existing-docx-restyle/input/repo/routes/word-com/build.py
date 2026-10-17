"""Generate the canonical report inside Microsoft Word using Python + pywin32."""
import argparse
import importlib.metadata
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from word_com import word_application, utf16_length

# These are the six tested native Word inputs, not a general LaTeX parser.
LINEAR = (
    'i_(L) (t)=I_0+Δi sin(ωt)',
    'H(s)=1/(LCs^2+RCs+1)',
    'E=∫_0^T▒v(t)i(t)ⅆt',
    'A=[■(0&1@-ω_0^2&-2ζω_0)]',
    'u(t)={■(U_("dc"),&t≥0@0,&t<0)┤',
    '█(v_L&=L (ⅆi_L)/(ⅆt)@i_C&=C (ⅆv_C)/(ⅆt))',
)


def compose(word, doc, fixture):
    # Word properties use points. Keep unit conversion independent of COM
    # utility methods, which return E_FAIL on this Office build via pywin32.
    def mm(value):
        return value * 72 / 25.4

    def add_text(text, style=-1):
        start = doc.Content.End - 1
        doc.Range(start, start).InsertAfter(text + '\r')
        rng = doc.Range(start, start + utf16_length(text) + 1)
        rng.Style = doc.Styles.Item(style)
        return rng

    def page_break():
        doc.Range(doc.Content.End - 1, doc.Content.End - 1).InsertBreak(7)

    def set_style(style_id, size, bold=False, alignment=0):
        style = doc.Styles.Item(style_id)
        font = style.Font
        font.Name = 'Times New Roman'
        font.NameFarEast = '仿宋'
        font.Size = size
        font.Bold = -1 if bold else 0
        font.Italic = 0
        font.Color = 0
        paragraph = style.ParagraphFormat
        paragraph.Alignment = alignment
        paragraph.FirstLineIndent = 0
        paragraph.SpaceBefore = paragraph.SpaceAfter = 0
        paragraph.LineSpacingRule = 1
        paragraph.WidowControl = -1
        return paragraph

    def replace_field(token, code, bookmark=None):
        rng = doc.Content.Duplicate
        if not rng.Find.Execute(FindText=token, Wrap=0):
            raise RuntimeError(f'Field token not found: {token}')
        field = doc.Fields.Add(rng, -1, code, True)
        if bookmark:
            doc.Bookmarks.Add(bookmark, field.Result)

    page = doc.PageSetup
    page.PageWidth = mm(210)
    page.PageHeight = mm(297)
    for side, value in fixture['layout']['marginsMm'].items():
        setattr(page, side.capitalize() + 'Margin', mm(value))
    page.HeaderDistance = page.FooterDistance = mm(12.7)
    page.DifferentFirstPageHeaderFooter = -1
    set_style(-1, 12).FirstLineIndent = 24
    for style_id, size in [(-2, 15), (-3, 12)]:
        para = set_style(style_id, size, True)
        para.SpaceBefore, para.SpaceAfter, para.KeepWithNext = 12, 6, -1
    set_style(-63, 36, True, 1).SpaceBefore = 10
    for name in ['Cover Heading', 'Cover Meta', 'Equation', 'TOC Title']:
        doc.Styles.Add(name, 1)
    set_style('Cover Heading', 26, alignment=1).SpaceBefore = 70
    set_style('Cover Meta', 16, alignment=1).SpaceBefore = 18
    set_style('TOC Title', 18, True, 1)
    para = set_style('Equation', 12)
    para.SpaceBefore = para.SpaceAfter = 6
    para.KeepTogether = -1
    para.TabStops.ClearAll()
    para.TabStops.Add(mm(82.5), 1, 0)
    para.TabStops.Add(mm(165), 2, 0)
    set_style(-35, 12, alignment=1).KeepWithNext = -1
    for style_id in [-32, -33]:
        set_style(style_id, 10.5, alignment=1)
    for style_id in [-20, -21]:
        set_style(style_id, 12)
    doc.Sections.Item(1).Headers.Item(1).Range.Text = fixture['layout']['headerText']
    footer = doc.Sections.Item(1).Footers.Item(1).Range
    footer.ParagraphFormat.Alignment = 1
    doc.Fields.Add(footer, 33)
    add_text('国网科技报告风格样稿', 'Cover Heading')
    add_text('技术路线对比报告', -63)
    add_text('项目名称  ' + fixture['title'], 'Cover Meta').ParagraphFormat.SpaceBefore = 100
    add_text('文档用途  排版与公式转换实验', 'Cover Meta')
    add_text('编制日期  2026 年 10 月 10 日', 'Cover Meta')
    page_break()
    add_text('目录', 'TOC Title')
    add_text('@TOC@')
    page_break()
    headings, paragraphs = fixture['headings'], fixture['paragraphs']
    add_text('一、' + headings[0]['text'], -2)
    add_text(paragraphs[0]['text'])
    add_text(paragraphs[1]['textBeforeEquation'] + '@MATH0@' + paragraphs[1]['textAfterEquation'])
    add_text('参见表 @REFTABLE@ 和式（@REFEQ@）。' + paragraphs[2]['text'])
    add_text('二、' + headings[1]['text'], -2)
    for number in range(1, 6):
        if number == 3:
            add_text('（一）' + headings[2]['text'], -3)
        add_text(f'\t@MATH{number}@\t（@SEQ{number}@）', 'Equation')
    page_break()
    add_text('三、' + headings[3]['text'], -2)
    table_data = fixture['table']
    add_text('表 @TABLE@ ' + table_data['caption'], -35)
    count = len(table_data['rows']) * table_data['stressRepeatCount']
    table = doc.Tables.Add(doc.Range(doc.Content.End - 1, doc.Content.End - 1), count + 1, 4)
    table.AllowAutoFit = False
    table.Borders.Enable = 1
    table.Rows.AllowBreakAcrossPages = 0
    table.Rows.Item(1).HeadingFormat = -1
    table.Range.Font.Name = 'Times New Roman'
    table.Range.Font.NameFarEast = '仿宋'
    table.Range.Font.Size = 12
    para = table.Range.ParagraphFormat
    para.FirstLineIndent = 0
    para.Alignment = 1
    para.SpaceBefore = para.SpaceAfter = 0
    para.LineSpacingRule = 1
    for column, (width, title) in enumerate(zip(table_data['columnWidthsMm'], table_data['headers']), 1):
        table.Columns.Item(column).Width = mm(width)
        table.Cell(1, column).Range.Text = title
    table.Rows.Item(1).Range.Font.Bold = -1
    for number in range(1, count + 1):
        for column, value in enumerate(table_data['rows'][(number - 1) % len(table_data['rows'])], 1):
            table.Cell(number + 1, column).Range.Text = value + (f' {number}' if column == 1 else '')
    for index, linear in enumerate(LINEAR):
        rng = doc.Content.Duplicate
        if not rng.Find.Execute(FindText=f'@MATH{index}@', Wrap=0):
            raise RuntimeError(f'Missing math placeholder {index}')
        start = rng.Start
        rng.Text = linear
        math_range = doc.OMaths.Add(doc.Range(start, start + utf16_length(linear)))
        math_range.OMaths.Item(1).BuildUp()
        if index == 3:
            letter = doc.OMaths.Item(4).Range.Duplicate
            if not letter.Find.Execute(FindText='𝐴', Wrap=0):
                raise RuntimeError('Matrix symbol A not found')
            letter.Font.Bold, letter.Font.Italic = -1, 0
    for number in range(1, 6):
        replace_field(f'@SEQ{number}@', r'SEQ Equation \* ARABIC', 'EqFraction' if number == 1 else None)
    replace_field('@TABLE@', r'SEQ Table \* ARABIC', 'TableParameters')
    replace_field('@REFTABLE@', r'REF TableParameters \h')
    replace_field('@REFEQ@', r'REF EqFraction \h')
    replace_field('@TOC@', r'TOC \o "1-2" \h \z \u')


def build(output):
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    destination = output / 'word-com.raw.docx'
    if destination.exists():
        raise FileExistsError(f'Use a new output directory under out/: {destination}')
    fixture = json.loads((ROOT / 'fixtures/canonical.json').read_text(encoding='utf-8'))
    started = time.perf_counter()
    with word_application() as word:
        startup = time.perf_counter() - started
        doc = word.Documents.Add()
        compose(word, doc, fixture)
        doc.SaveAs2(str(destination), 16)
        record = dict(wordVersion=word.Version, wordBuild=word.Build,
                      startupSeconds=startup, generationSeconds=time.perf_counter() - started - startup,
                      mathCount=doc.OMaths.Count, mathInput='Word native UnicodeMath BuildUp',
                      controller='Python + pywin32', pywin32Version=importlib.metadata.version('pywin32'),
                      pythonExecutable=sys.executable)
        (output / 'word-com-generation.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    print(destination)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output_directory', type=Path)
    build(parser.parse_args().output_directory)
