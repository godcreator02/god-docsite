"""在 FastComposer 上再去掉填域时的 Find：占位符写进正文时记下位置，最后按位置处理。

脚注与链接先按正文顺序处理（它们改变正文长度，处理一个就把后面记下的位置平移）；
域与编号再从后往前处理，替换后面的不挪动前面的位置。脚注里的占位符照旧用 Find。
"""
import re

from docreport.word import MarkerFinder, find_text, utf16_length
from fast_composer import FastComposer

BODY_TOKEN = re.compile(r'@(?:FIELD|NUMSTART|NUMEND|LINK|NOTE)\d+@')


class FastComposer2(FastComposer):
    def __init__(self, doc, content, directory, layout=None):
        super().__init__(doc, content, directory, layout)
        self._token_positions = {}

    def record_tokens(self, text, start):
        if not self.in_main_story():
            return
        for match in BODY_TOKEN.finditer(text):
            self._token_positions[match.group()] = start + utf16_length(text[:match.start()])

    def paragraph(self, text, style=None):
        rng = super().paragraph(text, style)
        self.record_tokens(text, self._last_start)
        return rng

    def single_paragraph_cell(self, cell, node):
        text, spans = self.inline(node['content'])
        rng = cell.Range
        start = rng.Start
        rng.Text = text
        self.record_tokens(text, start)
        target = self.range_at(start, start + utf16_length(text))
        target.Style = self.style_object(self.layout.get(node['id'], {}).get('style') or self.style)
        self.apply_marks_at(start, spans)
        self.mark(node['id'], target, '_b')

    def shift_after(self, position, delta):
        if delta:
            for token, recorded in self._token_positions.items():
                if recorded > position:
                    self._token_positions[token] = recorded + delta

    def body_range(self, token):
        position = self._token_positions.pop(token, None)
        if position is None:
            return None, None
        return self.doc.Range(position, position + utf16_length(token)), position

    def compose_note(self, target, identifier):
        target.Text = ''
        note = self.doc.Footnotes.Add(Range=target, Text='')
        saved = self.container, self.cell, self.style, self.width
        self.container, self.cell, self.style = note, False, -30
        self.blocks(self.context['index'][identifier]['blocks'])
        self.trim_container()
        self.container, self.cell, self.style, self.width = saved

    def build(self):
        metadata = self.content['metadata']
        values = dict(reportTitle=metadata['title'], projectName='', author='、'.join(metadata.get('authors', [])),
                      revision=metadata.get('revision', ''), date=metadata.get('date', ''))
        values.update({x['id']: x['value'] for x in metadata.get('fields', [])})
        for control in self.doc.ContentControls:
            if control.Tag in values:
                control.Range.Text = values[control.Tag] or '​'
        if not self.doc.Bookmarks.Exists('ReportBodyStart'):
            raise ValueError('Template must contain ReportBodyStart')
        start = self.doc.Bookmarks.Item('ReportBodyStart').Range.Start
        self.doc.Range(start, self.doc.Content.End - 1).Delete()
        self.doc.Bookmarks.Add('ReportBodyStart', self.doc.Range(start, start))
        self.blocks(self.content['blocks'])
        for token, identifier in self.note_tokens:
            target, position = self.body_range(token)
            if target is None:
                self.compose_note(find_text(self.doc, token), identifier)
                continue
            before = self.doc.Content.End
            self.compose_note(target, identifier)
            self.shift_after(position, self.doc.Content.End - before)
        for token, text, url in self.links:
            target, position = self.body_range(token)
            if target is None:
                target = find_text(self.doc, token)
                target.Text = text
                self.doc.Hyperlinks.Add(target, url)
                continue
            before = self.doc.Content.End
            target.Text = text
            self.doc.Hyperlinks.Add(target, url)
            self.shift_after(position, self.doc.Content.End - before)
        pending = self.finish()
        for index, section in enumerate(self.doc.Sections, 1):
            if index > 1:
                section.Headers.Item(1).Range.Text = metadata.get('shortTitle', metadata['title'])
            if index > 3:
                footer = section.Footers.Item(1)
                footer.PageNumbers.RestartNumberingAtSection = False
                footer.PageNumbers.NumberStyle = 0
        return pending

    def add_field(self, rng, code, bookmark):
        field = self.doc.Fields.Add(rng, -1, code, False)
        font = field.Code.Font
        font.Bold, font.Italic = 0, 0
        if bookmark:
            self._bookmark_collection.Add(bookmark, field.Result)

    def finish(self):
        if self._finished:
            raise RuntimeError('Composer.finish() may only be called once.')
        doc = self.doc
        fields = {token: (code, bookmark) for token, code, bookmark in self._pending_fields}
        openings = {begin: (end, bookmark) for begin, end, bookmark in self._pending_numbers}
        closings = {end for _, end, _ in self._pending_numbers}
        # 正在处理的「章号-序号」：结尾标记与它当前的位置。紧挨在域后面的 Word 区域不跟着域移动，所以按正文长度的变化自己算
        open_number = None
        for position, token in sorted(((p, t) for t, p in self._token_positions.items()), reverse=True):
            rng = doc.Range(position, position + utf16_length(token))
            if token in fields:
                if open_number is None:
                    self.add_field(rng, *fields.pop(token))
                    continue
                before = doc.Content.End
                self.add_field(rng, *fields.pop(token))
                open_number[1] += doc.Content.End - before
            elif token in closings:
                if open_number is not None:
                    raise RuntimeError(f'编号占位符套在另一个编号里：{token}')
                rng.Delete()
                open_number = [token, position]
            elif token in openings:
                end_token, bookmark = openings.pop(token)
                if open_number is None or open_number[0] != end_token:
                    raise RuntimeError(f'编号占位符没有配对：{token}')
                rng.Delete()
                self._bookmark_collection.Add(bookmark, doc.Range(position, open_number[1] - utf16_length(token)))
                open_number = None
            else:
                raise RuntimeError(f'正文里记下的占位符没人处理：{token}')
        finder = MarkerFinder(doc)
        for token, code, bookmark in self._pending_fields:
            if token in fields:
                self.add_field(finder.find(token), *fields.pop(token))
        if openings:
            raise RuntimeError(f'编号占位符不在正文里：{sorted(openings)}')
        for table in doc.Tables:
            following = doc.Range(table.Range.End, table.Range.End).Paragraphs.First.Format
            following.SpaceBefore = max(6, following.SpaceBefore)
        self._finished = True
        return self.pending_math
