"""Reusable Word composition operations for trusted report modules.

The template supplies named paragraph styles. A report decides its chapter
layout, page breaks, figures and acceptance criteria; this module only writes
Word objects and deferred MathType/field placeholders.
"""
from pathlib import Path
import re

from docreport.word import utf16_length


def mm(value):
    """Convert millimetres to Word points."""
    return value * 72 / 25.4


def append(doc, text, style=-1):
    """Append a styled paragraph, returning its complete Word range."""
    if not isinstance(text, str):
        raise TypeError('Paragraph text must be a string.')
    start = doc.Content.End - 1
    doc.Range(start, start).InsertAfter(text + '\r')
    rng = doc.Range(start, start + utf16_length(text) + 1)
    rng.Style = doc.Styles.Item(style)
    return rng


class Composer:
    """Write reusable Word elements; finish fields before inserting MathType.

    ``@REF:BookmarkName@`` in paragraph text becomes a live Word REF field.
    Display equations use the template's Equation style with centre/right tab
    stops, chapter numbers from Heading 1, and a SEQ reset per chapter.
    """

    def __init__(self, doc):
        self.doc = doc
        self.pending_math = []
        self._pending_fields = []
        self._pending_numbers = []
        self._finished = False

    def field_token(self, code, bookmark=None):
        if self._finished:
            raise RuntimeError('Cannot append fields after Composer.finish().')
        token = f'@FIELD{len(self._pending_fields)}@'
        self._pending_fields.append((token, code + r' \* CHARFORMAT', bookmark))
        return token

    def paragraph(self, text, style=-1):
        if self._finished:
            raise RuntimeError('Cannot append content after Composer.finish().')
        if not isinstance(text, str):
            raise TypeError('Paragraph text must be a string.')
        text = re.sub(r'@REF:(\w+)@',
                      lambda match: self.field_token(r'REF ' + match[1] + r' \h'), text)
        return append(self.doc, text, style)

    def caption(self, kind, bookmark, text):
        if kind not in ('Table', 'Figure'):
            raise ValueError(f'Unknown caption kind: {kind}')
        name = {'Table': '表', 'Figure': '图'}[kind]
        number = self.field_token('SEQ ' + kind + r' \* ARABIC', bookmark)
        return self.paragraph(f'{name} {number}  {text}',
                              'Table Caption' if kind == 'Table' else -35)

    def list(self, items, ordered=False):
        doc = self.doc
        list_start = doc.Content.End - 1
        for item in items:
            self.paragraph(item, 'Report Number' if ordered else 'Report Bullet')
        if ordered:
            # A style-linked list merges distant lists on save. Each independent
            # list needs its own native numbering definition to restart at one.
            rng = doc.Range(list_start, doc.Content.End - 1)
            rng.ListFormat.RemoveNumbers()
            source = doc.Styles.Item('Report Number').ListTemplate.ListLevels.Item(1)
            numbering = doc.ListTemplates.Add(False)
            level = numbering.ListLevels.Item(1)
            for prop in ('NumberFormat', 'NumberStyle', 'NumberPosition',
                         'TextPosition', 'TabPosition', 'TrailingCharacter'):
                setattr(level, prop, getattr(source, prop))
            level.StartAt = 1
            rng.ListFormat.ApplyListTemplateWithLevel(
                ListTemplate=numbering, ContinuePreviousList=False,
                ApplyTo=2, DefaultListBehavior=1, ApplyLevel=1)

    def math(self, equation, *, inline=False, before='', after='', bookmark=None,
             bold_symbol=None):
        if not isinstance(equation, dict) or not all(
                isinstance(equation.get(key), str) and equation[key]
                for key in ('id', 'latex')):
            raise ValueError('An equation requires non-empty string id and latex.')
        if not inline and not bookmark:
            raise ValueError('A display equation requires a numbering bookmark.')
        token = f'@MATH{len(self.pending_math)}@'
        self.pending_math.append(dict(token=token, equation=equation,
                                      kind='inline_math' if inline else 'math',
                                      boldSymbol=bold_symbol))
        if inline:
            return self.paragraph(before + token + after)
        chapter = self.field_token(r'STYLEREF 1 \s')
        number = self.field_token(r'SEQ Equation \* ARABIC \s 1')
        index = len(self._pending_numbers)
        begin, end = f'@NUMSTART{index}@', f'@NUMEND{index}@'
        self._pending_numbers.append((begin, end, bookmark))
        return self.paragraph(f'\t{token}\t({begin}{chapter}-{number}{end})', 'Equation')

    def footnote(self, token, text):
        rng = self.doc.Content.Duplicate
        if not rng.Find.Execute(FindText=token, Wrap=0):
            raise ValueError(f'Footnote token missing: {token}')
        rng.Text = ''
        return self.doc.Footnotes.Add(Range=rng, Text=text)

    def table(self, block):
        doc = self.doc
        headers, rows, widths = block['headers'], block['rows'], block['widthsMm']
        if not headers or len(widths) != len(headers):
            raise ValueError('A table needs a non-empty header and one width per column.')
        if any(len(row) != len(headers) for row in rows):
            raise ValueError('Table rows must have the same column count as the header.')
        self.caption('Table', block['id'], block['caption'])
        extra = 1 if block.get('groupTitle') else 0
        table = doc.Tables.Add(doc.Range(doc.Content.End - 1, doc.Content.End - 1),
                               len(rows) + 1 + extra, len(headers))
        table.AllowAutoFit = False
        table.Borders.Enable = 1
        table.Rows.AllowBreakAcrossPages = 0
        table.Range.Style = doc.Styles.Item('Table Text')
        table.TopPadding = table.BottomPadding = 3
        table.LeftPadding = table.RightPadding = 4
        for index, width in enumerate(widths, 1):
            table.Columns.Item(index).Width = mm(width)
        for row_index, row in enumerate([headers] + rows, 1 + extra):
            for column_index, value in enumerate(row, 1):
                table.Cell(row_index, column_index).Range.Text = str(value)
        for row_index in range(1, 2 + extra):
            row = table.Rows.Item(row_index)
            row.HeadingFormat = -1
            row.Range.Style = doc.Styles.Item('Table Header')
            row.Shading.BackgroundPatternColor = 0xEFEFEF
        if extra:
            table.Cell(1, 1).Merge(table.Cell(1, len(headers)))
            table.Cell(1, 1).Range.Text = block['groupTitle']
        if block.get('minRowHeightPt'):
            table.Rows.HeightRule = 1
            table.Rows.Height = block['minRowHeightPt']
        table.Range.ParagraphFormat.KeepWithNext = 0
        table.Rows.Item(1 + extra).Range.ParagraphFormat.KeepWithNext = -1
        doc.Bookmarks.Add(block['id'] + 'Data', table.Range)
        return table

    def figure(self, path, *, width_mm, bookmark, caption):
        path = Path(path).resolve()
        if not path.is_file():
            raise FileNotFoundError(path)
        rng = self.paragraph('', 'Figure')
        picture = self.doc.InlineShapes.AddPicture(
            str(path), False, True, self.doc.Range(rng.Start, rng.Start))
        picture.LockAspectRatio = -1
        picture.Width = mm(width_mm)
        picture.AlternativeText = caption
        self.caption('Figure', bookmark, caption)
        return picture

    def hyperlink(self, text, url):
        rng = self.paragraph(text, 'Report Note')
        return self.doc.Hyperlinks.Add(self.doc.Range(rng.Start, rng.End - 1), url)

    def finish(self):
        """Resolve deferred fields/bookmarks once; return MathType work items."""
        if self._finished:
            raise RuntimeError('Composer.finish() may only be called once.')
        doc = self.doc
        for token, code, bookmark in self._pending_fields:
            rng = doc.Content.Duplicate
            if not rng.Find.Execute(FindText=token, Wrap=0):
                raise RuntimeError(f'Field token missing: {token}')
            field = doc.Fields.Add(rng, -1, code, False)
            field.Code.Font.Bold, field.Code.Font.Italic = 0, 0
            if bookmark:
                doc.Bookmarks.Add(bookmark, field.Result)
        for begin, end, bookmark in self._pending_numbers:
            rng = doc.Content.Duplicate
            if not rng.Find.Execute(FindText=end, Wrap=0):
                raise RuntimeError(f'Number boundary missing: {end}')
            end_position = rng.Start
            rng.Delete()
            rng = doc.Content.Duplicate
            if not rng.Find.Execute(FindText=begin, Wrap=0):
                raise RuntimeError(f'Number boundary missing: {begin}')
            start_position = rng.Start
            rng.Delete()
            doc.Bookmarks.Add(bookmark, doc.Range(
                start_position, end_position - utf16_length(begin)))
        for table in doc.Tables:
            following = doc.Range(table.Range.End, table.Range.End).Paragraphs.First.Format
            following.SpaceBefore = max(6, following.SpaceBefore)
        self._finished = True
        return self.pending_math
