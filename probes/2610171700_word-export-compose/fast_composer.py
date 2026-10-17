"""排版稿少调 COM 的写法，先在测时里和原版交替比，定下来再并进引擎。

写出的文档应与原版相同；只改「怎么拿到区域、样式、书签集合」，不改写什么。
"""
from docreport.compose import ContentComposer
from docreport.word import utf16_length


class FastComposer(ContentComposer):
    def __init__(self, doc, content, directory, layout=None):
        super().__init__(doc, content, directory, layout)
        self._style_objects = {}
        self._bookmark_collection = doc.Bookmarks
        self._last_range = None
        self._last_start = None

    def style_object(self, name):
        style = self._style_objects.get(name)
        if style is None:
            style = self._style_objects[name] = self.doc.Styles.Item(name)
        return style

    def in_main_story(self):
        # 正文与正文表格的单元格在主文字流里；脚注（container 是脚注、不是单元格）不在
        return self.container is None or self.cell

    def range_at(self, start, end):
        if self.in_main_story():
            return self.doc.Range(start, end)
        rng = self.container.Range.Duplicate
        rng.SetRange(start, end)
        return rng

    def insertion_point(self):
        if self.container is None:
            position = self.doc.Content.End - 1
            return self.doc.Range(position, position), position
        rng = self.container.Range.Duplicate
        position = rng.End - 1
        rng.SetRange(position, position)
        return rng, position

    def point(self):
        return self.insertion_point()[0]

    def paragraph(self, text, style=None):
        rng, start = self.insertion_point()
        # InsertBefore 之后区域扩到刚插进去的文字（含段落标记）
        rng.InsertBefore(text + '\r')
        rng.Style = self.style_object(self.style if style is None else style)
        self._last_range, self._last_start = rng, start
        return rng

    def part(self, rng, offset, length):
        if rng is self._last_range:
            return self.range_at(self._last_start + offset, self._last_start + offset + length)
        return super().part(rng, offset, length)

    def mark(self, identifier, rng, suffix=''):
        from docreport.content import bookmark
        self._bookmark_collection.Add(bookmark(identifier, suffix), rng)

    def rich_paragraph(self, nodes, style=None, prefix='', suffix=''):
        text, spans = self.inline(nodes)
        rng = self.paragraph(prefix + text + suffix, style)
        self.apply_marks_at(self._last_start + utf16_length(prefix), spans)
        self._last_range = rng
        return rng

    def apply_marks(self, rng, offset, spans):
        start = self._last_start if rng is self._last_range else rng.Start
        self.apply_marks_at(start + offset, spans)

    def apply_marks_at(self, base, spans):
        for start, length, marks in spans:
            if not marks:
                continue
            run = self.range_at(base + start, base + start + length)
            for mark in marks:
                if mark == 'code':
                    run.Font.Name = 'Consolas'
                elif mark == 'math':
                    run.Style = self.inline_math_style()
                elif mark == 'strong':
                    run.Bold = True
                elif mark == 'em':
                    run.Italic = True
                else:
                    setattr(run.Font, {'sup': 'Superscript', 'sub': 'Subscript'}[mark], True)

    def single_paragraph_cell(self, cell, node):
        text, spans = self.inline(node['content'])
        rng = cell.Range
        start = rng.Start
        rng.Text = text
        target = self.range_at(start, start + utf16_length(text))
        target.Style = self.style_object(self.layout.get(node['id'], {}).get('style') or self.style)
        self.apply_marks_at(start, spans)
        self.mark(node['id'], target, '_b')

    def table_node(self, node, depth):
        from docreport.content import table_grid
        placements = table_grid(node)
        merged = any(rs > 1 or cs > 1 for _, _, rs, cs, _ in placements)
        if merged:
            return super().table_node(node, depth)
        if node.get('caption'):
            self.numbered_caption(node, 'Table')
        target = self.point()
        table = self.doc.Tables.Add(target, len(node['rows']), len(node['columns']))
        table.AllowAutoFit = False
        table.Borders.Enable = 1
        table.Rows.AllowBreakAcrossPages = 0
        table.Range.Style = self.style_object('Table Text')
        table.TopPadding = table.BottomPadding = 3
        table.LeftPadding = table.RightPadding = 4
        layout = self.layout.get(node['id'], {})
        widths = layout.get('widthsMm')
        from docreport.compose import mm
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
        saved = self.container, self.cell, self.style, self.width
        for r, c, rs, cs, cell in placements:
            self.container = table.Cell(r + 1, c + 1)
            self.cell = True
            self.style = 'Table Header' if r < node['headerRows'] else 'Table Text'
            self.width = sum(widths[c:c + cs]) - 8
            if len(cell['blocks']) == 1 and cell['blocks'][0]['type'] == 'paragraph':
                self.single_paragraph_cell(self.container, cell['blocks'][0])
                continue
            self.container.Range.Text = ''
            self.blocks(cell['blocks'], depth)
            self.trim_container()
        self.container, self.cell, self.style, self.width = saved
        self.mark(node['id'], table.Range, '_b')
        return table

    def finish(self):
        if self._finished:
            raise RuntimeError('Composer.finish() may only be called once.')
        from docreport.word import MarkerFinder
        doc = self.doc
        fields = MarkerFinder(doc)
        for token, code, bookmark in self._pending_fields:
            rng = fields.find(token)
            field = doc.Fields.Add(rng, -1, code, False)
            font = field.Code.Font
            font.Bold, font.Italic = 0, 0
            if bookmark:
                self._bookmark_collection.Add(bookmark, field.Result)
        numbers = MarkerFinder(doc)
        for begin, end, bookmark in self._pending_numbers:
            opening = numbers.find(begin)
            closing = numbers.find(end)
            end_position = closing.Start
            closing.Delete()
            start_position = opening.Start
            opening.Delete()
            self._bookmark_collection.Add(bookmark, doc.Range(start_position, end_position - utf16_length(begin)))
        for table in doc.Tables:
            following = doc.Range(table.Range.End, table.Range.End).Paragraphs.First.Format
            following.SpaceBefore = max(6, following.SpaceBefore)
        self._finished = True
        return self.pending_math
