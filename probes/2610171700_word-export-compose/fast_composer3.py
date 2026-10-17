"""在引擎（已并入 fast2 的写法）上再试两处：
1. 域代码只在占位符所在段落的样式本身加粗或倾斜时才清粗斜体
2. 表格正文单元格不再重设「Table Text」样式（建表时整张表已设过）
"""
import re

from docreport.compose import ContentComposer
from docreport.word import utf16_length

FIELD_MARKER = re.compile(r'@FIELD\d+@')


class FastComposer3(ContentComposer):
    def __init__(self, doc, content, directory, layout=None):
        super().__init__(doc, content, directory, layout)
        self._field_styles = {}
        self._styles_with_emphasis = {}

    def style_has_emphasis(self, name):
        known = self._styles_with_emphasis.get(name)
        if known is None:
            font = self.style_object(name).Font
            known = self._styles_with_emphasis[name] = bool(font.Bold) or bool(font.Italic)
        return known

    def note_field_styles(self, text, style):
        for match in FIELD_MARKER.finditer(text):
            self._field_styles[match.group()] = style

    def paragraph(self, text, style=None):
        rng = super().paragraph(text, style)
        self.note_field_styles(text, self.style if style is None else style)
        return rng

    def single_paragraph_cell(self, cell, node):
        text, spans = self.inline(node['content'])
        rng = cell.Range
        start = rng.Start
        rng.Text = text
        self.record_tokens(text, start)
        override = self.layout.get(node['id'], {}).get('style')
        chosen = override or self.style
        self.note_field_styles(text, chosen)
        target = self.range_at(start, start + utf16_length(text))
        if override or chosen != 'Table Text':
            target.Style = self.style_object(chosen)
        self.apply_marks_at(start, spans)
        self.mark(node['id'], target, '_b')

    def add_field(self, token, rng, code, bookmark):
        field = self.doc.Fields.Add(rng, -1, code, False)
        style = self._field_styles.get(token)
        if style is None or self.style_has_emphasis(style):
            font = field.Code.Font
            font.Bold, font.Italic = 0, 0
        if bookmark:
            self._bookmark_collection.Add(bookmark, field.Result)
