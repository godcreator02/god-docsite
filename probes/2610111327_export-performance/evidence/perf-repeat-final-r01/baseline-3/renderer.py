"""Reusable Word composition operations for trusted report modules.

The template supplies named paragraph styles. A report decides its chapter
layout, page breaks, figures and acceptance criteria; this module only writes
Word objects and deferred MathType/field placeholders.
"""
from pathlib import Path
import re

from frozen_word import utf16_length, find_text


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


class ContentComposer(Composer):
    """Render protocol nodes into a body, cell or note using the same operations."""

    def __init__(self, doc, content, directory, layout=None):
        super().__init__(doc)
        from frozen_content import validate_content
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

    def point(self):
        rng = self.doc.Content.Duplicate if self.container is None else self.container.Range.Duplicate
        # Word exposes the cell's CR/BEL terminator as one Range position.
        position = rng.End - 1
        rng.SetRange(position, position)
        return rng

    def paragraph(self, text, style=None):
        rng = self.point()
        start = rng.Start
        rng.InsertBefore(text + '\r')
        rng.SetRange(start, start + utf16_length(text) + 1)
        rng.Style = self.doc.Styles.Item(self.style if style is None else style)
        return rng

    def part(self, rng, offset, length):
        result = rng.Duplicate
        result.SetRange(rng.Start + offset, rng.Start + offset + length)
        return result

    def mark(self, identifier, rng, suffix=''):
        from frozen_content import bookmark
        self.doc.Bookmarks.Add(bookmark(identifier, suffix), rng)

    def math_token(self, node, inline):
        from frozen_content import bookmark
        token = f'@MATH{len(self.pending_math)}@'
        # Hash the transport ID so case or hyphen variants cannot collide in Word.
        equation = dict(id=bookmark(node['id']), latex=node['latex'])
        self.pending_math.append(dict(token=token, equation=equation,
                                      sourceId=node['id'], kind='inline_math' if inline else 'math'))
        return token

    def ref_token(self, node):
        from frozen_content import bookmark
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
                from frozen_content import bookmark
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
            run = self.part(rng, utf16_length(prefix) + start, length)
            for mark in marks:
                if mark == 'code':
                    run.Font.Name = 'Consolas'
                else:
                    setattr(run.Font, {'strong': 'Bold', 'em': 'Italic', 'sup': 'Superscript', 'sub': 'Subscript'}[mark], True)
        return rng

    def numbered_caption(self, node, kind):
        from frozen_content import bookmark
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
            from frozen_content import bookmark
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

    def table_node(self, node, depth):
        from frozen_content import table_grid
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
                from frozen_content import bookmark
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
