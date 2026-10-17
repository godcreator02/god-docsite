"""Reusable Word composition operations for trusted report modules.

The template supplies named paragraph styles. A report decides its chapter
layout, page breaks, figures and acceptance criteria; this module only writes
Word objects and deferred MathType/field placeholders.
"""
from pathlib import Path
import re
from xml.etree import ElementTree as ET

from docreport.word import utf16_length, find_text
from docreport.content import bookmark

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ET.register_namespace('w', W)


def _xml_child(parent, tag, **attrs):
    return ET.SubElement(parent, '{' + W + '}' + tag,
                         {'{' + W + '}' + key: str(value) for key, value in attrs.items()})


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
            rng = find_text(doc, token)
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


class _ObjectModelComposer(Composer):
    """Render protocol nodes into a body, cell or note using the same operations."""

    def __init__(self, doc, content, directory, layout=None):
        super().__init__(doc)
        from .content import validate_content
        self.content, self.directory = content, Path(directory)
        self.layout = layout or {}
        self.context = validate_content(content, directory)
        self.container = None
        self.cell = False
        self.style = -1
        self.width = doc.Sections.Last.PageSetup.PageWidth - doc.Sections.Last.PageSetup.LeftMargin - doc.Sections.Last.PageSetup.RightMargin
        self.orientation = 'portrait'
        self.chapter_style = 'Heading 1'
        self.chapter_is_appendix = False
        self.chapter_first_equation = False
        self.links, self.note_tokens = [], []
        self.section_depths = {}
        self.heading_lists = {}
        self.appendix_numbering = None
        self.appendix_count = 0
        self._bookmarks = doc.Bookmarks
        self._styles = doc.Styles
        self._style_cache = {}

    def point(self):
        rng = self.doc.Content if self.container is None else self.container.Range
        # Word exposes the cell's CR/BEL terminator as one Range position.
        position = rng.End - 1
        rng.SetRange(position, position)
        return rng

    def paragraph(self, text, style=None):
        rng = self.point()
        start = rng.Start
        rng.InsertBefore(text + '\r')
        rng.SetRange(start, start + utf16_length(text) + 1)
        name = self.style if style is None else style
        if name not in self._style_cache:
            self._style_cache[name] = self._styles.Item(name)
        rng.Style = self._style_cache[name]
        return rng

    def part(self, rng, offset, length):
        result = rng.Duplicate
        start = rng.Start + offset
        result.SetRange(start, start + length)
        return result

    def mark(self, identifier, rng, suffix=''):
        from .content import bookmark
        self._bookmarks.Add(bookmark(identifier, suffix), rng)

    def math_token(self, node, inline):
        from .content import bookmark
        token = f'@MATH{len(self.pending_math)}@'
        # Hash the transport ID so case or hyphen variants cannot collide in Word.
        equation = dict(id=bookmark(node['id']), latex=node['latex'])
        self.pending_math.append(dict(token=token, equation=equation,
                                      sourceId=node['id'], kind='inline_math' if inline else 'math'))
        return token

    def ref_token(self, node):
        from .content import bookmark
        target = self.context['index'][node['target']]
        kind, display = target['type'], node['display']
        if display == 'title':
            return self.field_token('REF ' + bookmark(target['id'], '_t') + r' \h')
        if kind == 'section':
            value = self.field_token('REF ' + bookmark(target['id'], '_t') + r' \n \h')
        else:
            value = self.field_token('REF ' + bookmark(target['id'], '_n') + r' \h')
        if display == 'number':
            return value
        if kind == 'equation':
            return '式（' + value + '）'
        if kind == 'section':
            return ('附录 ' + value if target['numbering'] == 'appendix' else '第 ' + value + ' 节')
        return {'figure': '图 ', 'table': '表 '}[kind] + value

    def inline(self, nodes):
        text, spans = '', []
        for node in nodes:
            kind = node['type']
            if kind == 'text':
                value = node['text']
            elif kind == 'math':
                value = self.math_token(node, True)
            elif kind == 'ref':
                value = self.ref_token(node)
            elif kind == 'break':
                value = '\v'
            elif kind == 'link':
                value = f'@LINK{len(self.links)}@'
                self.links.append((value, node['text'], node['href']))
            elif kind == 'note_ref':
                value = f'@NOTE{len(self.note_tokens)}@'
                self.note_tokens.append((value, node['target']))
            elif kind == 'cite':
                from .content import bookmark
                value = '[' + ', '.join(self.field_token('REF ' + bookmark(x, '_n') + r' \h') for x in node['targets']) + ']'
            else:
                raise ValueError(f'Unsupported inline type: {kind}')
            spans.append((utf16_length(text), utf16_length(value), node.get('marks', [])))
            text += value
        return text, spans

    def rich_paragraph(self, nodes, style=None, prefix='', suffix=''):
        text, spans = self.inline(nodes)
        rng = self.paragraph(prefix + text + suffix, style)
        for start, length, marks in spans:
            if not marks:
                continue
            run = self.part(rng, utf16_length(prefix) + start, length)
            font = run.Font
            for mark in marks:
                if mark == 'code':
                    font.Name = 'Consolas'
                else:
                    setattr(font, {'strong': 'Bold', 'em': 'Italic', 'sup': 'Superscript', 'sub': 'Subscript'}[mark], True)
        return rng

    def numbered_caption(self, node, kind):
        from .content import bookmark
        numbered = node.get('numbered', True)
        prefix = ''
        if numbered:
            prefix = {'Figure': '图 ', 'Table': '表 '}[kind] + self.field_token('SEQ ' + kind + r' \* ARABIC', bookmark(node['id'], '_n')) + '  '
        rng = self.rich_paragraph(node['caption'], 'Table Caption' if kind == 'Table' else -35, prefix=prefix)
        title = self.part(rng, utf16_length(prefix), rng.End - rng.Start - utf16_length(prefix) - 1)
        self.mark(node['id'], title, '_t')

    def abstract_node(self, node):
        # Create document-owned styles; the input DOTX remains unchanged.
        names = ('DR Abstract Heading', 'DR Abstract Body', 'DR Abstract Keywords')
        for name, base in zip(names, (-2, -1, -1)):
            try:
                style = self.doc.Styles.Item(name)
            except Exception:
                style = self.doc.Styles.Add(name, 1)
            style.BaseStyle = self.doc.Styles.Item(base).NameLocal
            style.AutomaticallyUpdate = False
            fmt = style.ParagraphFormat
            fmt.LeftIndent = fmt.RightIndent = 0
            fmt.PageBreakBefore = False
            fmt.KeepWithNext = name == names[0]
            fmt.OutlineLevel = 1 if name == names[0] else 10
            if name != names[1]:
                fmt.CharacterUnitFirstLineIndent = 0
                fmt.FirstLineIndent = 0
                fmt.Alignment = 1 if name == names[0] else 0
        start = self.point().Start
        heading = self.paragraph(node.get('title', '摘要'), names[0])
        heading.ListFormat.RemoveNumbers()
        self.mark(node['id'], heading, '_h')
        for block in node['paragraphs']:
            rng = self.rich_paragraph(block['content'], names[1])
            self.mark(block['id'], rng, '_b')
        keywords = self.rich_paragraph([
            dict(type='text', text='关键词：', marks=['strong']),
            dict(type='text', text='；'.join(node['keywords'])),
        ], names[2])
        self.mark(node['id'], keywords, '_k')
        self.mark(node['id'], self.doc.Range(start, keywords.End), '_b')

    def section(self, node, depth):
        layout = self.layout.get(node['id'], {})
        orientation = layout.get('orientation', self.orientation)
        if orientation != self.orientation:
            self.point().InsertBreak(2)
            section = self.doc.Sections.Last
            section.PageSetup.Orientation = 1 if orientation == 'landscape' else 0
            self.orientation = orientation
            self.width = section.PageSetup.PageWidth - section.PageSetup.LeftMargin - section.PageSetup.RightMargin
        elif layout.get('pageBreakBefore'):
            self.point().InsertBreak(7)
        mode = node['numbering']
        style = -2 - depth
        appendix = mode == 'appendix' or (depth > 0 and self.chapter_is_appendix)
        if appendix:
            style = 'Appendix Heading' if depth == 0 else f'DR Appendix Heading {depth+1}'
            if depth > 0:
                try:
                    self.doc.Styles.Item(style)
                except Exception:
                    added = self.doc.Styles.Add(style, 1)
                    # A built-in Heading base inherits its active body list;
                    # Word can then switch the appendix child to B.1 on apply.
                    added.BaseStyle = 'Appendix Heading'
                    base = self.doc.Styles.Item(-2-depth)
                    added.Font.Size = base.Font.Size
                    added.ParagraphFormat.SpaceBefore = base.ParagraphFormat.SpaceBefore
                    added.ParagraphFormat.SpaceAfter = base.ParagraphFormat.SpaceAfter
        rng = self.paragraph(node['title'], style)
        if mode == 'none':
            rng.ListFormat.RemoveNumbers()
        if appendix and mode != 'none':
            continued = self.appendix_numbering is not None
            if not continued:
                self.appendix_numbering = self.doc.ListTemplates.Add(True)
                for n in range(1, 10):
                    level = self.appendix_numbering.ListLevels.Item(n)
                    # Default outline templates link built-in headings; applying a
                    # child level would otherwise switch styles and list instances.
                    level.LinkedStyle = ''
                    level.NumberFormat = '附录 %1' if n == 1 else '.'.join('%'+str(i) for i in range(1,n+1))
                    level.NumberStyle = 3 if n == 1 else 0
                    level.StartAt, level.ResetOnHigher = 1, n-1
                    level.NumberPosition, level.TextPosition, level.TabPosition = 0, 0, 0
            rng.ListFormat.ApplyListTemplateWithLevel(self.appendix_numbering, continued, 2, 1, depth+1)
            rng.ParagraphFormat.OutlineLevel = depth+1
        self.section_depths[node['id']] = mode
        self.mark(node['id'], self.part(rng, 0, rng.End - rng.Start - 1), '_t')
        if depth == 0:
            self.chapter_style = 'Appendix Heading' if mode == 'appendix' else 'Heading 1'
            self.chapter_is_appendix = mode == 'appendix'
            if mode == 'appendix':
                self.appendix_count += 1
            self.chapter_first_equation = True
        self.blocks(node['children'], depth + 1)

    def equation(self, node):
        token = self.math_token(node, False)
        suffix = ''
        if node['numbered']:
            chapter = self.field_token(r'STYLEREF 1 \s' if self.chapter_style == 'Heading 1' else r'STYLEREF "Appendix Heading" \s')
            if self.chapter_is_appendix:
                # The SEQ "\s 1" restart only fires on built-in Heading 1
                # paragraphs; the template's Appendix Heading is Normal-based,
                # so appendix sequences never restart there. Giving each
                # appendix its own SEQ identifier keeps a natural 1, 2, 3 …
                # count that renumbers on insert or delete like main chapters,
                # without touching heading styles or their linked lists.
                letter = chr(ord('A') + self.appendix_count - 1)
                number = self.field_token(r'SEQ EquationAppendix' + letter + r' \* ARABIC')
            else:
                number = self.field_token(r'SEQ Equation \* ARABIC \s 1')
            self.chapter_first_equation = False
            i = len(self._pending_numbers)
            begin, end = f'@NUMSTART{i}@', f'@NUMEND{i}@'
            from .content import bookmark
            self._pending_numbers.append((begin, end, bookmark(node['id'], '_n')))
            suffix = f'\t({begin}{chapter}-{number}{end})'
        rng = self.paragraph('\t' + token + suffix, 'Equation')
        rng.ParagraphFormat.TabStops.ClearAll()
        rng.ParagraphFormat.TabStops.Add(self.width / 2, 1, 0)
        rng.ParagraphFormat.TabStops.Add(self.width, 2, 0)

    def figure_node(self, node):
        layout = self.layout.get(node['id'], {})
        width = min(mm(layout.get('widthMm', self.width * 25.4 / 72)), self.width)
        rng = self.paragraph('', 'Figure')
        picture = self.doc.InlineShapes.AddPicture(str(self.context['assets'][node['id']]), False, True, self.part(rng, 0, 0))
        picture.LockAspectRatio = -1
        picture.Width = width
        picture.AlternativeText = node['alt']
        self.numbered_caption(node, 'Figure')

    @staticmethod
    def _can_bulk_table(node):
        """Tabs/paragraph marks delimit cells, so ambiguous or nested content
        keeps the structural writer. This changes transport, not the schema."""
        for row in node['rows']:
            for cell in row['cells']:
                blocks = cell['blocks']
                if (cell.get('rowSpan', 1) != 1 or cell.get('colSpan', 1) != 1
                        or len(blocks) != 1 or blocks[0]['type'] != 'paragraph'):
                    return False
                for item in blocks[0]['content']:
                    if item['type'] == 'break' or any(ord(ch) < 32 for ch in item.get('text', '')):
                        return False
        return True


    def table_node(self, node, depth):
        from .content import table_grid
        placements = table_grid(node)
        if node.get('caption'):
            self.numbered_caption(node, 'Table')
        target = self.point()
        table = self.doc.Tables.Add(target, len(node['rows']), len(node['columns']))
        table.AllowAutoFit = False
        table.Borders.Enable = 1
        table.Rows.AllowBreakAcrossPages = 0
        table.Range.Style = self.doc.Styles.Item('Table Text')
        table.TopPadding = table.BottomPadding = 3
        table.LeftPadding = table.RightPadding = 4
        layout = self.layout.get(node['id'], {})
        widths = layout.get('widthsMm')
        if widths is not None:
            if len(widths) != len(node['columns']) or any(x <= 0 for x in widths) or mm(sum(widths)) > self.width + 1:
                raise ValueError(f"{node['id']}: column widths exceed available space")
            widths = [mm(x) for x in widths]
        else:
            widths = [self.width / len(node['columns'])] * len(node['columns'])
        for c, width in enumerate(widths, 1):
            table.Columns.Item(c).Width = width
        for r in range(1, node['headerRows'] + 1):
            table.Rows.Item(r).HeadingFormat = -1
            table.Rows.Item(r).Shading.BackgroundPatternColor = 0xEFEFEF
        if layout.get('minRowHeightPt'):
            table.Rows.HeightRule, table.Rows.Height = 1, layout['minRowHeightPt']
        cells = {(r, c): table.Cell(r + 1, c + 1).Range.Duplicate
                 for r in range(len(node['rows'])) for c in range(len(node['columns']))}
        for r, c, rs, cs, cell in reversed(placements):
            if rs > 1 or cs > 1:
                cells[r, c].Cells.Item(1).Merge(cells[r + rs - 1, c + cs - 1].Cells.Item(1))
        saved = self.container, self.cell, self.style, self.width
        for r, c, rs, cs, cell in placements:
            self.container = cells[r, c].Cells.Item(1)
            # Merge can concatenate the original empty cell paragraphs.
            self.container.Range.Text = ''
            self.cell = True
            self.style = 'Table Header' if r < node['headerRows'] else 'Table Text'
            self.width = sum(widths[c:c + cs]) - 8
            self.blocks(cell['blocks'], depth)
            self.trim_container()
        self.container, self.cell, self.style, self.width = saved
        self.mark(node['id'], table.Range, '_b')
        return table

    def trim_container(self):
        rng = self.container.Range.Duplicate
        end = rng.End - 1
        # Remove the surplus terminal paragraph only after a paragraph, never a table.
        if end > rng.Start and rng.Paragraphs.Count > 1:
            tail = rng.Duplicate
            tail.SetRange(end - 1, end)
            if tail.Text == '\r':
                tail.Delete()

    def list_node(self, node, depth, list_depth=0):
        numbering = self.doc.ListTemplates.Add(False)
        level = numbering.ListLevels.Item(1)
        level.NumberFormat = '%1.' if node['ordered'] else '•'
        level.NumberStyle = 0 if node['ordered'] else 23
        level.StartAt = node.get('start', 1)
        level.NumberPosition = 18 * list_depth
        level.TextPosition = level.TabPosition = 18 * (list_depth + 1)
        level.TrailingCharacter = 0
        first = True
        for item in node['items']:
            marked = False
            for child in item['blocks']:
                if child['type'] == 'list':
                    if not marked:
                        rng = self.paragraph('', 'Report Number' if node['ordered'] else 'Report Bullet')
                        rng.ListFormat.RemoveNumbers()
                        rng.ListFormat.ApplyListTemplateWithLevel(numbering, not first, 2, 1, 1)
                        first, marked = False, True
                    self.list_node(child, depth, list_depth + 1)
                    continue
                rng = self.rich_paragraph(child['content'], 'Report Number' if node['ordered'] else 'Report Bullet')
                rng.ListFormat.RemoveNumbers()
                if not marked:
                    rng.ListFormat.ApplyListTemplateWithLevel(numbering, not first, 2, 1, 1)
                    first, marked = False, True
                else:
                    rng.ParagraphFormat.LeftIndent = level.TextPosition

    def blocks(self, nodes, depth=0):
        for node in nodes:
            kind = node['type']
            if kind == 'abstract':
                self.abstract_node(node)
            elif kind == 'section':
                self.section(node, depth)
            elif kind == 'paragraph':
                rng = self.rich_paragraph(node['content'], self.layout.get(node['id'], {}).get('style'))
                self.mark(node['id'], rng, '_b')
            elif kind == 'equation':
                self.equation(node)
            elif kind == 'figure':
                self.figure_node(node)
            elif kind == 'table':
                self.table_node(node, depth)
            elif kind == 'list':
                self.list_node(node, depth)
            elif kind == 'code':
                for line in node['text'].split('\n'):
                    rng = self.paragraph(line.replace('\t', '    '))
                    rng.Font.Name, rng.Font.Size = 'Consolas', 10
                    rng.ParagraphFormat.FirstLineIndent = 0
            elif kind == 'bibliography':
                from .content import bookmark
                for ident in self.context['citations']:
                    entry = self.context['index'][ident]
                    number = self.field_token(r'SEQ Bibliography \* ARABIC', bookmark(ident, '_n'))
                    inlines = [dict(type='text', text=entry['text'])]
                    if entry.get('url'):
                        inlines += [dict(type='text', text=' '), dict(type='link', text=entry['url'], href=entry['url'])]
                    self.rich_paragraph(inlines, prefix='[' + number + '] ')
            else:
                raise ValueError(f'Unsupported block: {kind}')

    def build(self):
        metadata = self.content['metadata']
        values = dict(reportTitle=metadata['title'], projectName='', author='、'.join(metadata.get('authors', [])),
                      revision=metadata.get('revision', ''), date=metadata.get('date', ''))
        values.update({x['id']: x['value'] for x in metadata.get('fields', [])})
        for control in self.doc.ContentControls:
            if control.Tag in values:
                control.Range.Text = values[control.Tag] or '\u200b'
        if not self.doc.Bookmarks.Exists('ReportBodyStart'):
            raise ValueError('Template must contain ReportBodyStart')
        start = self.doc.Bookmarks.Item('ReportBodyStart').Range.Start
        self.doc.Range(start, self.doc.Content.End - 1).Delete()
        self.doc.Bookmarks.Add('ReportBodyStart', self.doc.Range(start, start))
        self.blocks(self.content['blocks'])
        for token, identifier in self.note_tokens:
            target = find_text(self.doc, token)
            target.Text = ''
            note = self.doc.Footnotes.Add(Range=target, Text='')
            saved = self.container, self.cell, self.style, self.width
            self.container, self.cell, self.style = note, False, -30
            self.blocks(self.context['index'][identifier]['blocks'])
            self.trim_container()
            self.container, self.cell, self.style, self.width = saved
        for token, text, url in self.links:
            target = find_text(self.doc, token)
            self.doc.Hyperlinks.Add(target, url, TextToDisplay=text)
        pending = self.finish()
        for index, section in enumerate(self.doc.Sections, 1):
            if index > 1:
                section.Headers.Item(1).Range.Text = metadata.get('shortTitle', metadata['title'])
            if index > 3:
                footer = section.Footers.Item(1)
                footer.PageNumbers.RestartNumberingAtSection = False
                footer.PageNumbers.NumberStyle = 0
        return pending

class ContentComposer(_ObjectModelComposer):
    """Batch native Word XML at body boundaries; retain COM for live operations."""
    @staticmethod
    def _can_xml_paragraph(nodes, style=-1):
        return ((isinstance(style, str) or style in (-1, -35, -30))
                and all(not any(ord(c) < 32 and c not in '\t\v' for c in n.get('text', ''))
                        for n in nodes))

    def style_id(self, name):
        name = {-1: 'Normal', -35: 'caption', -30: 'footnote text'}.get(name, name)
        if not hasattr(self, '_xml_styles') or name not in self._xml_styles:
            self._xml_package_text = self.doc.WordOpenXML
            root = ET.fromstring(self._xml_package_text)
            self._xml_styles = {}
            for style in root.findall('.//{' + W + '}styles/{' + W + '}style'):
                title = style.find('{' + W + '}name')
                ident = style.get('{' + W + '}styleId')
                if title is not None:
                    self._xml_styles[title.get('{' + W + '}val')] = ident
            self._xml_bookmark = getattr(self, '_xml_bookmark', 100000)
        return self._xml_styles[name]

    def paragraph_xml(self, block, style, prefix='', suffix='', title_bookmark=None):
        p = ET.Element('{' + W + '}p')
        _xml_child(_xml_child(p, 'pPr'), 'pStyle', val=self.style_id(style))
        ident = self._xml_bookmark
        self._xml_bookmark += 1
        if block.get('id'):
            _xml_child(p, 'bookmarkStart', id=ident, name=bookmark(block['id'], '_b'))
        text, spans = self.inline(block['content'])
        from docreport.word import utf16_length
        spans = ([(0, utf16_length(prefix), [])] +
                 [(utf16_length(prefix) + start, length, marks) for start, length, marks in spans] +
                 [(utf16_length(prefix + text), utf16_length(suffix), [])])
        text = prefix + text + suffix
        east_asia = (self.content['metadata'].get('language', '').lower().startswith(('zh', 'ja', 'ko'))
                     and any('\u3400' <= c <= '\u9fff' or '\u3040' <= c <= '\u30ff'
                             or '\uac00' <= c <= '\ud7af' or '\U00020000' <= c <= '\U0002ffff'
                             for c in text))
        encoded = text.encode('utf-16-le')
        title_id = self._xml_bookmark
        self._xml_bookmark += 1
        for span_index, (start, length, marks) in enumerate(spans):
            if title_bookmark and span_index == 1:
                _xml_child(p, 'bookmarkStart', id=title_id, name=title_bookmark)
            if title_bookmark and span_index == len(spans) - 1:
                _xml_child(p, 'bookmarkEnd', id=title_id)
            run = _xml_child(p, 'r')
            props = _xml_child(run, 'rPr')
            fonts = _xml_child(props, 'rFonts')
            if east_asia:
                fonts.set('{' + W + '}hint', 'eastAsia')
            if marks:
                for mark in marks:
                    if mark in ('strong', 'em'):
                        _xml_child(props, 'b' if mark == 'strong' else 'i')
                    elif mark in ('sub', 'sup'):
                        _xml_child(props, 'vertAlign', val='subscript' if mark == 'sub' else 'superscript')
                    elif mark == 'code':
                        for script in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
                            fonts.set('{' + W + '}' + script, 'Consolas')
            value = encoded[2 * start:2 * (start + length)].decode('utf-16-le')
            for fragment in re.split(r'([\t\v]|@FIELD\d+@)', value):
                if re.fullmatch(r'@FIELD\d+@', fragment):
                    _, code, name = self._pending_fields[int(fragment[6:-1])]
                    if not hasattr(self, '_xml_fields'):
                        self._xml_fields = set()
                    self._xml_fields.add(fragment)
                    _xml_child(_xml_child(p, 'r'), 'fldChar', fldCharType='begin')
                    code_run = _xml_child(p, 'r')
                    code_props = _xml_child(code_run, 'rPr')
                    _xml_child(code_props, 'b', val=0); _xml_child(code_props, 'i', val=0)
                    instruction = _xml_child(code_run, 'instrText')
                    instruction.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
                    instruction.text = ' ' + code + ' '
                    _xml_child(_xml_child(p, 'r'), 'fldChar', fldCharType='separate')
                    if name:
                        fid = self._xml_bookmark; self._xml_bookmark += 1
                        _xml_child(p, 'bookmarkStart', id=fid, name=name)
                    _xml_child(_xml_child(p, 'r'), 't').text = '0'
                    if name:
                        _xml_child(p, 'bookmarkEnd', id=fid)
                    _xml_child(_xml_child(p, 'r'), 'fldChar', fldCharType='end')
                    run = _xml_child(p, 'r')
                    continue
                if fragment in ('\t', '\v'):
                    _xml_child(run, 'tab' if fragment == '\t' else 'br')
                elif fragment:
                    node = _xml_child(run, 't')
                    node.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
                    node.text = fragment
        if block.get('id'):
            _xml_child(p, 'bookmarkEnd', id=ident)
        return p

    def finish(self):
        self._pending_fields = [item for item in self._pending_fields
                                if item[0] not in getattr(self, '_xml_fields', set())]
        return super().finish()

    def equation_xml(self, node):
        """Write the live number fields and their bookmark with the formula slot."""
        token = self.math_token(node, False)
        number, suffix, name = '', '', None
        if node['numbered']:
            chapter = self.field_token(r'STYLEREF 1 \s' if self.chapter_style == 'Heading 1'
                                       else r'STYLEREF "Appendix Heading" \s')
            if self.chapter_is_appendix:
                letter = chr(ord('A') + self.appendix_count - 1)
                sequence = self.field_token(r'SEQ EquationAppendix' + letter + r' \* ARABIC')
            else:
                sequence = self.field_token(r'SEQ Equation \* ARABIC \s 1')
            self.chapter_first_equation = False
            number, suffix, name = chapter + '-' + sequence, ')', bookmark(node['id'], '_n')
        prefix = '\t' + token + ('\t(' if node['numbered'] else '')
        p = self.paragraph_xml({'content': [dict(type='text', text=number)]}, 'Equation',
                               prefix=prefix, suffix=suffix, title_bookmark=name)
        stops = [(round(self.width * 10), 'center'), (round(self.width * 20), 'right')]
        if not hasattr(self, '_equation_style_tabs'):
            self._equation_style_tabs = [round(tab.Position * 20)
                                         for tab in self._styles.Item('Equation').ParagraphFormat.TabStops]
        tabs = _xml_child(p.find('{' + W + '}pPr'), 'tabs')
        current = {pos for pos, _ in stops}
        values = [(pos, 'clear') for pos in self._equation_style_tabs if pos not in current] + stops
        for pos, alignment in sorted(values):
            _xml_child(tabs, 'tab', val=alignment, pos=pos)
        return p

    def numbered_caption(self, node, kind):
        if self.container is not None:
            return super().numbered_caption(node, kind)
        prefix = ''
        if node.get('numbered', True):
            prefix = {'Figure': '图 ', 'Table': '表 '}[kind] + self.field_token(
                'SEQ ' + kind + r' \* ARABIC', bookmark(node['id'], '_n')) + '  '
        body = ET.Element('{' + W + '}body')
        body.append(self.paragraph_xml({'content': node['caption']},
                    'Table Caption' if kind == 'Table' else -35, prefix=prefix,
                    title_bookmark=bookmark(node['id'], '_t')))
        _xml_child(body, 'p')
        self.insert_body(body)

    def equation(self, node):
        if self.container is not None:
            return super().equation(node)
        body = ET.Element('{' + W + '}body')
        body.append(self.equation_xml(node))
        _xml_child(body, 'p')
        self.insert_body(body)

    def blocks(self, nodes, depth=0):
        if self.container is not None:
            return super().blocks(nodes, depth)
        body = ET.Element('{' + W + '}body')
        def flush():
            if len(body):
                _xml_child(body, 'p')
                self.insert_body(body)
                body.clear()
        for node in nodes:
            if (node['type'] == 'paragraph' and self._can_xml_paragraph(
                    node['content'], self.layout.get(node['id'], {}).get('style', self.style))):
                style = self.layout.get(node['id'], {}).get('style', self.style)
                body.append(self.paragraph_xml(node, style))
            elif node['type'] == 'table' and self._can_bulk_table(node):
                self.append_table_xml(body, node)
            elif node['type'] == 'equation':
                body.append(self.equation_xml(node))
            else:
                flush()
                super().blocks([node], depth)
        flush()

    def insert_body(self, body, *, range_required=False):
        target = self.point()
        payload, changed = re.subn(r'<w:body(?:\s[^>]*)?>.*?</w:body>',
                                  lambda match: ET.tostring(body, encoding='unicode'),
                                  self._xml_package_text, count=1, flags=re.S)
        if changed != 1:
            raise ValueError('Word XML packet must contain exactly one body.')
        target.InsertXML(payload)
        if range_required:
            target.End = self.doc.Content.End - 1
        return target

    def rich_paragraph(self, nodes, style=None, prefix='', suffix=''):
        if (self.container is not None or not self._can_xml_paragraph(
                nodes, self.style if style is None else style)
                or any(ord(c) < 32 and c not in '\t\v' for c in prefix + suffix)):
            return super().rich_paragraph(nodes, style, prefix, suffix)
        body = ET.Element('{' + W + '}body')
        body.append(self.paragraph_xml({'content': nodes}, self.style if style is None else style,
                                       prefix, suffix))
        _xml_child(body, 'p')  # InsertXML merges the final paragraph into the insertion point.
        return self.insert_body(body, range_required=True)

    def table_node(self, node, depth):
        if self.container is not None or not self._can_bulk_table(node):
            return super().table_node(node, depth)
        body = ET.Element('{' + W + '}body')
        self.append_table_xml(body, node)
        return self.insert_body(body, range_required=True).Tables.Item(1)

    def append_table_xml(self, body, node):
        self.style_id('Table Text')
        count = len(node['columns'])
        layout = self.layout.get(node['id'], {})
        widths = layout.get('widthsMm')
        if widths is not None:
            if len(widths) != count or any(x <= 0 for x in widths) or mm(sum(widths)) > self.width + 1:
                raise ValueError(f"{node['id']}: column widths exceed available space")
            widths = [mm(x) for x in widths]
        else:
            widths = [self.width / count] * count
        if node.get('caption'):
            prefix = ''
            if node.get('numbered', True):
                prefix = '表 ' + self.field_token(r'SEQ Table \* ARABIC', bookmark(node['id'], '_n')) + '  '
            body.append(self.paragraph_xml({'content': node['caption']}, 'Table Caption', prefix=prefix,
                                           title_bookmark=bookmark(node['id'], '_t')))
        ident = self._xml_bookmark
        self._xml_bookmark += 1
        _xml_child(body, 'bookmarkStart', id=ident, name=bookmark(node['id'], '_b'))
        tbl = _xml_child(body, 'tbl')
        props = _xml_child(tbl, 'tblPr')
        _xml_child(props, 'tblW', w=0, type='auto')
        borders = _xml_child(props, 'tblBorders')
        for name in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
            _xml_child(borders, name, val='single', sz=4, space=0, color='auto')
        _xml_child(props, 'tblLayout', type='fixed')
        margins = _xml_child(props, 'tblCellMar')
        for name, value in [('top', 60), ('left', 80), ('bottom', 60), ('right', 80)]:
            _xml_child(margins, name, w=value, type='dxa')
        _xml_child(props, 'tblLook', val='0000', firstRow=0, lastRow=0, firstColumn=0,
              lastColumn=0, noHBand=0, noVBand=0)
        grid = _xml_child(tbl, 'tblGrid')
        for width in widths:
            _xml_child(grid, 'gridCol', w=round(width * 20))
        for ri, row in enumerate(node['rows']):
            tr = _xml_child(tbl, 'tr')
            row_props = _xml_child(tr, 'trPr')
            _xml_child(row_props, 'cantSplit')
            if ri < node['headerRows']:
                _xml_child(row_props, 'tblHeader')
            if layout.get('minRowHeightPt'):
                _xml_child(row_props, 'trHeight', val=round(layout['minRowHeightPt'] * 20), hRule='atLeast')
            for ci, cell in enumerate(row['cells']):
                tc = _xml_child(tr, 'tc')
                tc_props = _xml_child(tc, 'tcPr')
                _xml_child(tc_props, 'tcW', w=round(widths[ci] * 20), type='dxa')
                if ri < node['headerRows']:
                    _xml_child(tc_props, 'shd', val='clear', color='auto', fill='EFEFEF')
                tc.append(self.paragraph_xml(cell['blocks'][0],
                                            'Table Header' if ri < node['headerRows'] else 'Table Text'))
        _xml_child(body, 'bookmarkEnd', id=ident)
