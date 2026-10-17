"""Restyle the supplied SST technical report through desktop Word.

This route keeps existing equations, pictures and tables in the DOCX. It does
not use the six-equation fixture builder or convert formulas through text.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from word_com import word_application, opened_document

MARKDOWN_LINK = re.compile(r'\[([^\]\r]+)\]\((https?://[^\s)]+)(?:\s+"citation")?\)')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def media_hashes(path):
    with ZipFile(path) as archive:
        return Counter(hashlib.sha256(archive.read(name)).hexdigest()
                       for name in archive.namelist()
                       if name.startswith('word/media/') and not name.endswith('/'))


def b1_rows(table):
    """Canonicalize the source's escaped-pipe table header, keeping every value."""
    clean = lambda row, col: table.Cell(row, col).Range.Text.rstrip('\r\x07')
    if clean(1, 1) != '调制' or clean(1, 2) != '参数':
        return None
    rows = [[clean(r, c) for c in range(1, table.Columns.Count + 1)]
            for r in range(1, table.Rows.Count + 1)]
    if table.Columns.Count == 9:
        if rows[0][5:] != ['\\', 'i_sw\\', '原/副边', '双桥ZVS']:
            raise AssertionError('Unrecognized B-1 header; do not infer a repair')
        if any(any(value.strip() for value in row[7:]) for row in rows[1:]):
            raise AssertionError('B-1 extra columns contain data')
        rows = [rows[0][:5] + ['|i_sw| 原/副边', rows[0][-1]]] + [row[:7] for row in rows[1:]]
    elif table.Columns.Count != 7 or rows[0][5:] != ['|i_sw| 原/副边', '双桥ZVS']:
        raise AssertionError('Unexpected B-1 table shape')
    return rows


def repair_b1(doc):
    for table in doc.Tables:
        rows = b1_rows(table)
        if rows is None or table.Columns.Count == 7:
            continue
        table.Columns.Item(9).Delete()
        table.Columns.Item(8).Delete()
        table.Cell(1, 6).Range.Text = rows[0][5]
        table.Cell(1, 7).Range.Text = rows[0][6]
        table.PreferredWidthType, table.PreferredWidth = 3, 165 * 72 / 25.4
        for i, width in enumerate([20, 25, 25, 20, 20, 30, 25], 1):
            table.Columns.Item(i).SetWidth(width * 72 / 25.4, 0)
        if b1_rows(table) != rows:
            raise AssertionError('B-1 numeric data changed during header repair')
        print('Restored B-1 header to seven columns; all three data rows match', flush=True)


def content_state(doc):
    text = doc.Content.Text
    for toc in doc.TablesOfContents:
        field_text = toc.Range.Text
        if field_text and field_text not in text:
            raise AssertionError('Cannot separate TOC result from body text')
        text = text.replace(field_text, '', 1)
    for table in doc.Tables:
        rows = b1_rows(table)
        if rows is not None:
            text = text.replace(table.Range.Text, json.dumps(rows, ensure_ascii=False), 1)
    # Blank lines, page breaks and wrapping are layout rather than content.
    targets = [link.Address for link in doc.Hyperlinks if link.Address]
    targets.extend(match[1] for match in MARKDOWN_LINK.findall(text))
    normalized = re.sub(r'\s+', '', MARKDOWN_LINK.sub(lambda match: match[1], text))
    return dict(bodySha256=hashlib.sha256(normalized.encode('utf-8')).hexdigest(),
                bodyCharacters=len(normalized),
                sourceLinkTargets=sorted(targets),
                equations=[re.sub(r'\s+', '', item.Range.Text) for item in doc.OMaths],
                tables=doc.Tables.Count, pictures=doc.InlineShapes.Count,
                shapes=doc.Shapes.Count)


def set_font(rng, size, bold=None, latin='Times New Roman', east_asian='仿宋'):
    rng.Font.Name = latin
    rng.Font.NameFarEast = east_asian
    rng.Font.Size = size
    rng.Font.Color = 0
    if bold is not None:
        rng.Font.Bold = -1 if bold else 0


def restyle(doc):
    mm = lambda value: value * 72 / 25.4
    width = mm(165)
    repair_b1(doc)
    for section in doc.Sections:
        page = section.PageSetup
        page.PageWidth, page.PageHeight = mm(210), mm(297)
        page.TopMargin = page.BottomMargin = mm(25.4)
        page.LeftMargin, page.RightMargin = mm(23), mm(22)
        page.HeaderDistance = page.FooterDistance = mm(12.7)
        page.DifferentFirstPageHeaderFooter = -1

    # Preserve every URL as a real hyperlink instead of literal Markdown syntax.
    for match in reversed(list(MARKDOWN_LINK.finditer(doc.Content.Text))):
        rng = doc.Content.Duplicate
        if not rng.Find.Execute(FindText=match[0], Wrap=0):
            raise AssertionError('Source citation link was not found')
        doc.Hyperlinks.Add(Anchor=rng, Address=match[2], TextToDisplay=match[1])

    # Snapshot classification before normalizing direct formatting.
    body = []
    for paragraph in doc.Paragraphs:
        rng = paragraph.Range.Duplicate
        if rng.Information(12):  # wdWithInTable
            continue
        text = rng.Text.strip('\r\n\x07\x0c\x0b ')
        name = rng.Font.Name
        body.append((rng, text, paragraph.OutlineLevel,
                     name == 'Courier New' or any(c in text for c in '│─┌└├┬┤┐┘')
                     or len(rng.Text) - len(rng.Text.lstrip(' ')) >= 8,
                     rng.Font.Bold == -1))
    print(f'Classified {len(body)} body paragraphs', flush=True)

    set_font(doc.Content, 12)
    pf = doc.Content.ParagraphFormat
    pf.Alignment = 3
    pf.FirstLineIndent = 24
    pf.LeftIndent = pf.RightIndent = 0
    pf.SpaceBefore = pf.SpaceAfter = 0
    pf.LineSpacingRule = 1
    pf.DisableLineHeightGrid = -1
    pf.WidowControl = -1
    pf.KeepWithNext = 0
    pf.KeepTogether = 0
    pf.PageBreakBefore = 0
    pf.Borders.Enable = 0

    for key, size in [(-1, 12), (-2, 15), (-3, 12), (-20, 12), (-21, 12)]:
        style = doc.Styles.Item(key)
        set_font(style, size, key in (-2, -3))
        style.ParagraphFormat.DisableLineHeightGrid = -1
        style.ParagraphFormat.LineSpacingRule = 1
        style.ParagraphFormat.FirstLineIndent = 0 if key != -1 else 24

    cover = True
    cover_title_set = False
    for index, (rng, text, level, monospace, was_bold) in enumerate(body):
        para = rng.ParagraphFormat
        if re.fullmatch(r'摘\s*要', text):
            cover = False
        if cover:
            para.Alignment = 1
            para.FirstLineIndent = 0
            if not text:
                set_font(rng, 1)
                para.LineSpacingRule, para.LineSpacing = 4, 1
            elif not cover_title_set:
                rng.Style = doc.Styles.Item(-63)  # wdStyleTitle
                set_font(rng, 36, True)
                para.SpaceBefore, para.SpaceAfter = 68, 18
                para.LineSpacingRule = 0
                para.KeepTogether = -1
                cover_title_set = True
            elif text.startswith('编制日期'):
                set_font(rng, 16, False)
                para.SpaceBefore = 95
            elif text.startswith('版本'):
                set_font(rng, 16, False)
                para.SpaceBefore = 12
            else:
                set_font(rng, 16, False)
                para.LineSpacingRule = 1
                para.KeepTogether = -1
            continue

        if re.fullmatch(r'(摘\s*要|目\s*录)', text):
            set_font(rng, 18, True)
            para.Alignment, para.FirstLineIndent = 1, 0
            para.SpaceAfter, para.KeepWithNext = 12, -1
        elif level in (1, 2):
            set_font(rng, 15 if level == 1 else 12, True)
            para.Alignment, para.FirstLineIndent = 0, 0
            para.SpaceBefore, para.SpaceAfter = 12, 6
            para.KeepWithNext = para.KeepTogether = -1
            para.PageBreakBefore = -1 if level == 1 and text.startswith('附录') else 0
        elif monospace:
            set_font(rng, 8, False, latin='Courier New', east_asian='宋体')
            para.Alignment, para.FirstLineIndent = 0, 0
            para.LineSpacingRule, para.LineSpacing = 4, 11
            para.KeepTogether = -1
            para.KeepWithNext = -1 if index + 1 < len(body) and body[index + 1][3] else 0
        elif re.match(r'^表\s*[A-D]?\s*\d', text):
            set_font(rng, 12, False)
            para.Alignment, para.FirstLineIndent = 1, 0
            para.SpaceBefore, para.SpaceAfter = 6, 4
            para.KeepWithNext = para.KeepTogether = -1
        elif re.match(r'^图\s*[A-D]?\s*[-\d]', text):
            set_font(rng, 10.5, False)
            para.Alignment, para.FirstLineIndent = 1, 0
            para.SpaceAfter, para.KeepTogether = 6, -1
        elif rng.InlineShapes.Count:
            para.Alignment, para.FirstLineIndent = 1, 0
            para.KeepTogether = para.KeepWithNext = -1
            para.SpaceBefore = 6
        elif text.startswith('•'):
            para.LeftIndent, para.FirstLineIndent = 12, -12
        elif was_bold and len(text) < 70:
            para.KeepWithNext = -1
        elif not text and '\x0c' not in rng.Text:
            set_font(rng, 4)
            para.LineSpacingRule, para.LineSpacing = 4, 4

    print('Body formatting complete', flush=True)
    for number, table in enumerate(doc.Tables, 1):
        table.AllowAutoFit = False
        table.PreferredWidthType, table.PreferredWidth = 3, width
        table.Rows.Alignment = 1
        table.Rows.AllowBreakAcrossPages = 0
        table.Rows.HeightRule = 0
        table.Rows.Item(1).HeadingFormat = -1
        table.TopPadding = table.BottomPadding = 3
        table.LeftPadding = table.RightPadding = 4
        table.Borders.Enable = 1
        table.Borders.OutsideLineStyle = table.Borders.InsideLineStyle = 1
        table.Borders.OutsideLineWidth = table.Borders.InsideLineWidth = 4
        table.Borders.OutsideColor = table.Borders.InsideColor = 0
        for cell in table.Range.Cells:
            borders = cell.Borders
            borders.OutsideLineStyle, borders.OutsideLineWidth, borders.OutsideColor = 1, 4, 0
        columns = table.Columns.Count
        old_widths = [table.Columns.Item(i).Width for i in range(1, columns + 1)]
        if columns == 2:
            weights = [45, 120]
        elif columns == 3:
            first_headers = [table.Cell(1, i).Range.Text.strip('\r\x07') for i in range(1, 4)]
            weights = [12, 38, 115] if first_headers[0] == '序号' else ([35, 70, 60] if first_headers[1] == '算式' else [45, 60, 60])
        else:
            weights = old_widths
        for i, weight in enumerate(weights, 1):
            table.Columns.Item(i).SetWidth(width * weight / sum(weights), 0)
        dense_comparison = b1_rows(table) is not None
        set_font(table.Range, 9.5 if columns >= 8 or dense_comparison else 10.5)
        tpf = table.Range.ParagraphFormat
        tpf.Alignment = 0
        tpf.FirstLineIndent = tpf.LeftIndent = tpf.RightIndent = 0
        tpf.SpaceBefore = tpf.SpaceAfter = 0
        tpf.LineSpacingRule, tpf.LineSpacing = 5, 13.2
        tpf.KeepWithNext = tpf.KeepTogether = tpf.PageBreakBefore = 0
        tpf.DisableLineHeightGrid = -1
        table.Range.Cells.VerticalAlignment = 1
        table.Range.Shading.BackgroundPatternColor = 16777215
        header = table.Rows.Item(1).Range
        header.Font.Bold = -1
        header.ParagraphFormat.Alignment = 1
        header.ParagraphFormat.KeepWithNext = -1
        header.Shading.BackgroundPatternColor = 15921906
        if number % 8 == 0:
            print(f'Formatted {number}/{doc.Tables.Count} tables', flush=True)

    # A dedicated landscape section keeps the vendor comparison readable.
    vendor_table = next((table for table in doc.Tables
                         if table.Cell(1, 1).Range.Text.strip('\r\x07') == '企业（产品）'), None)
    if vendor_table is not None:
        caption = next(rng for rng, text, *_ in body if re.match(r'^表\s*11[-－]1', text))
        before_table = doc.Range(caption.Start, caption.Start)
        after_table = doc.Range(vendor_table.Range.End, vendor_table.Range.End)
        after_table.InsertBreak(2)  # wdSectionBreakNextPage
        before_table.InsertBreak(2)
        wide_section = vendor_table.Range.Sections.Item(1)
        wide_section.PageSetup.Orientation = 1
        wide_section.PageSetup.PageWidth = mm(297)
        wide_section.PageSetup.PageHeight = mm(210)
        wide_section.PageSetup.DifferentFirstPageHeaderFooter = 0
        vendor_table.PreferredWidth = mm(252)
        for i, width_mm in enumerate([40, 40, 30, 23, 35, 84], 1):
            vendor_table.Columns.Item(i).SetWidth(mm(width_mm), 0)
        for index in range(2, doc.Sections.Count + 1):
            doc.Sections.Item(index).PageSetup.DifferentFirstPageHeaderFooter = 0

    for shape in doc.InlineShapes:
        if shape.Width > width:
            shape.LockAspectRatio = -1
            shape.Width = width
    for equation in doc.OMaths:
        equation.Range.Font.Name = 'Cambria Math'

    for section in doc.Sections:
        header = section.Headers.Item(1).Range
        header.Text = '10 kV 直挂型 SST 系统设计报告'
        set_font(header, 10.5, False)
        header.ParagraphFormat.Alignment = 1
        header.ParagraphFormat.FirstLineIndent = 0
        footer = section.Footers.Item(1).Range
        footer.Text = ''
        footer.Fields.Add(footer, 33)  # wdFieldPage
        set_font(footer, 10.5, False)
        footer.ParagraphFormat.Alignment = 1
        footer.ParagraphFormat.FirstLineIndent = 0
    for toc in doc.TablesOfContents:
        toc.Update()
    doc.ActiveWindow.View.Type = 3  # wdPrintView before pagination and saving
    doc.Repaginate()
    for toc in doc.TablesOfContents:
        toc.UpdatePageNumbers()


def build(source, output):
    source, output = source.resolve(), output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    final = output / 'wf10kV直挂SST系统设计方案_国网报告风格.docx'
    pdf = final.with_suffix('.pdf')
    if final.exists() or pdf.exists() or source == final:
        raise FileExistsError('Use a fresh output directory')
    original_hash = sha(source)
    print(f'Opening {source.name}', flush=True)
    with word_application() as word:
        word.ScreenUpdating = False
        with opened_document(word, source, True) as doc:
            before = content_state(doc)
            print(f'Input: {before["tables"]} tables, {len(before["equations"])} equations', flush=True)
            doc.ActiveWindow.View.Type = 1  # wdNormalView avoids repeated layout work
            pagination = word.Options.Pagination
            try:
                word.Options.Pagination = False
                restyle(doc)
            finally:
                word.Options.Pagination = pagination
            after = content_state(doc)
            if after != before:
                (output / 'content-mismatch.json').write_text(json.dumps({'before': before, 'after': after}, ensure_ascii=False, indent=2), encoding='utf-8')
                raise AssertionError('Restyling changed source content')
            doc.SaveAs2(str(final), 16)
            print('Saved DOCX; reopening for PDF export', flush=True)
        with opened_document(word, final, True) as doc:
            reopened = content_state(doc)
            if reopened != before:
                raise AssertionError('Content changed after saving and reopening')
            doc.Repaginate()
            doc.ExportAsFixedFormat(str(pdf), 17, CreateBookmarks=1)
            record = dict(source=str(source), sourceSha256=original_hash,
                          output=str(final), outputSha256=sha(final),
                          wordVersion=word.Version, wordBuild=word.Build,
                          pages=doc.ComputeStatistics(2), preservedContent=before,
                          tocCount=doc.TablesOfContents.Count,
                          tocEntries=doc.TablesOfContents.Item(1).Range.Paragraphs.Count if doc.TablesOfContents.Count else 0,
                          reopenedContentMatches=True,
                          imageBytesPreserved=media_hashes(source) == media_hashes(final))
    assert sha(source) == original_hash
    assert record['imageBytesPreserved'], 'Embedded image bytes changed'
    (output / 'restyle-verification.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in record.items() if k != 'preservedContent'}, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output_directory', type=Path)
    args = parser.parse_args()
    build(args.source, args.output_directory)
