"""Candidate bulk table transport, isolated from the production renderer."""
from baseline_compose import ContentComposer, mm
from frozen_word import utf16_length


class BulkComposer(ContentComposer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bookmarks = self.doc.Bookmarks
        self._styles = self.doc.Styles
        self._style_cache = {}

    def mark(self, identifier, rng, suffix=''):
        from frozen_content import bookmark
        self._bookmarks.Add(bookmark(identifier, suffix), rng)

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

    def rich_paragraph(self, nodes, style=None, prefix='', suffix=''):
        text, spans = self.inline(nodes)
        rng = self.paragraph(prefix + text + suffix, style)
        for start, length, marks in spans:
            if not marks:
                continue
            font = self.part(rng, utf16_length(prefix) + start, length).Font
            for mark in marks:
                if mark == 'code':
                    font.Name = 'Consolas'
                else:
                    setattr(font, {'strong':'Bold', 'em':'Italic', 'sup':'Superscript', 'sub':'Subscript'}[mark], True)
        return rng

    def table_node(self, node, depth):
        cells = [cell for row in node['rows'] for cell in row['cells']]
        if (self.container is not None or any(
                cell.get('rowSpan', 1) != 1 or cell.get('colSpan', 1) != 1
                or len(cell['blocks']) != 1 or cell['blocks'][0]['type'] != 'paragraph'
                or any(ch in item.get('text', '') for item in cell['blocks'][0]['content']
                       for ch in '\t\r\n') for cell in cells)):
            return super().table_node(node, depth)
        if node.get('caption'):
            self.numbered_caption(node, 'Table')
        compiled = [self.inline(cell['blocks'][0]['content']) for cell in cells]
        count = len(node['columns'])
        text = '\r'.join('\t'.join(compiled[i + j][0] for j in range(count))
                         for i in range(0, len(cells), count)) + '\r'
        target = self.point()
        start = target.Start
        target.InsertBefore(text)
        target.SetRange(start, start + utf16_length(text))
        table = target.ConvertToTable(Separator=1, NumRows=len(node['rows']),
                                     NumColumns=count, AutoFitBehavior=0,
                                     DefaultTableBehavior=1)
        table.AllowAutoFit = False
        table.Borders.Enable = 1
        table.Rows.AllowBreakAcrossPages = 0
        table.Range.Style = self.doc.Styles.Item('Table Text')
        table.TopPadding = table.BottomPadding = 3
        table.LeftPadding = table.RightPadding = 4
        layout = self.layout.get(node['id'], {})
        widths = layout.get('widthsMm')
        if widths is not None:
            if len(widths) != count or any(x <= 0 for x in widths) or mm(sum(widths)) > self.width + 1:
                raise ValueError(f"{node['id']}: column widths exceed available space")
            widths = [mm(x) for x in widths]
        else:
            widths = [self.width / count] * count
        for c, width in enumerate(widths, 1):
            table.Columns.Item(c).Width = width
        for r in range(1, node['headerRows'] + 1):
            row = table.Rows.Item(r)
            row.HeadingFormat = -1
            row.Shading.BackgroundPatternColor = 0xEFEFEF
            row.Range.Style = self.doc.Styles.Item('Table Header')
        if layout.get('minRowHeightPt'):
            table.Rows.HeightRule, table.Rows.Height = 1, layout['minRowHeightPt']
        cursor = table.Range.Start
        for index, (cell, (plain, spans)) in enumerate(zip(cells, compiled)):
            cell_length = utf16_length(plain)
            target = self.doc.Range(cursor, cursor + cell_length)
            for offset, length, marks in spans:
                if not marks:
                    continue
                run = self.part(target, offset, length)
                font = run.Font
                for mark in marks:
                    if mark == 'code':
                        font.Name = 'Consolas'
                    else:
                        setattr(font, {'strong': 'Bold', 'em': 'Italic', 'sup': 'Superscript', 'sub': 'Subscript'}[mark], True)
            self.mark(cell['blocks'][0]['id'], target, '_b')
            cursor += cell_length + 1
            if (index + 1) % count == 0:
                cursor += 1
        if cursor != table.Range.End:
            raise RuntimeError('Bulk table character offsets differ from Word.')
        self.mark(node['id'], table.Range, '_b')
        return table
