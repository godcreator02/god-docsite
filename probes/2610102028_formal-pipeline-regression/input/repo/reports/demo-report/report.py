"""Layout and acceptance rules for the ten-body-page demonstration report.

This trusted local Python module owns this report's chapter/page layout and
figures. Other reports provide their own module and content, reusing docreport's
Word and MathType operations.
"""
from pathlib import Path
import re

from PIL import Image, ImageDraw, ImageFont

from docreport.compose import Composer
from docreport.word import refresh, utf16_length


def draw_figure(block, output):
    """Deterministic figures; all numerical series come from the fixture."""
    path = output / (block['id'] + '.png')
    font_path = 'C:/Windows/Fonts/simsun.ttc'
    font = ImageFont.truetype(font_path, 32)
    small = ImageFont.truetype(font_path, 26)
    if block['kind'] == 'architecture':
        img = Image.new('RGB', (1600, 550), 'white')
        draw = ImageDraw.Draw(img)
        for i, (title, subtitle) in enumerate(zip(block['nodes'], block['subtitles'])):
            x, y = 40 + i * 400, 145
            draw.rounded_rectangle((x, y, x + 320, y + 210), 12, fill='#eef3f6', outline='#31546a', width=3)
            draw.text((x+160, y+55), title, font=font, anchor='mm', fill='#203a4c')
            lines = [subtitle] if len(subtitle) <= 9 else [subtitle[:7], subtitle[7:]]
            for j, line in enumerate(lines):
                draw.text((x+160, y+120+j*34), line, font=small, anchor='mm', fill='black')
            if i<3:
                draw.line((x+325,y+105,x+385,y+105),fill='#31546a',width=5)
                draw.polygon([(x+385,y+105),(x+371,y+96),(x+371,y+114)],fill='#31546a')
        draw.text((800,435),'配置与版本信息贯穿各模块；异常状态随接口传递',font=small,anchor='mm',fill='black')
    elif block['kind'] == 'response':
        img = Image.new('RGB',(1600,850),'white')
        draw = ImageDraw.Draw(img)
        left, top, right, bottom = 125, 100, 1510, 700
        def xy(t,y): return left+(right-left)*t/40, bottom-(bottom-top)*y
        for x in range(0,41,5):
            px,_=xy(x,0)
            draw.line((px,top,px,bottom),fill='#dddddd',width=2)
            draw.text((px,bottom+34),str(x),font=small,anchor='mm',fill='black')
        for y in [0,.2,.4,.6,.8,1.0]:
            _,py=xy(0,y)
            draw.line((left,py,right,py),fill='#dddddd',width=2)
            draw.text((left-20,py),f'{y:.1f}',font=small,anchor='rm',fill='black')
        draw.line((left,top,left,bottom,right,bottom),fill='black',width=3)
        draw.text((left,45),'归一化幅值 / p.u.',font=small,anchor='lm',fill='black')
        draw.text(((left+right)/2,800),'时间 / ms',font=font,anchor='mm',fill='black')
        samples=block['data']
        draw.line([xy(p['t'],p['y']) for p in samples], fill='#235879',width=6)
        step=[]
        for i,p in enumerate(samples):
            if i: step.append(xy(p['t'],samples[i-1]['u']))
            step.append(xy(p['t'],p['u']))
        draw.line(step,fill='#9d4f16',width=4)
        for x,label,color in [(890,'输入 u','#9d4f16'),(1180,'响应 y','#235879')]:
            draw.line((x,45,x+65,45),fill=color,width=6)
            draw.text((x+80,45),label,font=small,anchor='lm',fill='black')
    else:
        raise ValueError(f"Unknown figure kind: {block['kind']}")
    img.save(path)
    return path


def _check_content(content):
    if not isinstance(content, dict):
        raise TypeError('Report content must be a JSON object.')
    for key in ('metadata', 'equations', 'sections', 'shortTitle', 'expectedBodyPages'):
        if key not in content:
            raise ValueError(f'Missing demo report property: {key}')
    if not isinstance(content['metadata'], dict):
        raise TypeError('metadata must be a JSON object.')
    if not isinstance(content['shortTitle'], str) or not content['shortTitle']:
        raise ValueError('shortTitle must be a non-empty string.')
    if content['expectedBodyPages'] != 10:
        raise ValueError('This demonstration module validates exactly ten body pages.')
    equations = content['equations']
    if not isinstance(equations, list) or len(equations) != 6:
        raise ValueError('This demonstration report requires its six equation cases.')
    ids = []
    for equation in equations:
        if not isinstance(equation, dict) or not all(
                isinstance(equation.get(key), str) and equation[key]
                for key in ('id', 'latex')):
            raise ValueError('Each equation requires non-empty string id and latex.')
        ids.append(equation['id'])
    if len(set(ids)) != len(ids):
        raise ValueError('Equation ids must be unique.')
    sections = content['sections']
    if not isinstance(sections, list) or not sections:
        raise ValueError('sections must be a non-empty list.')
    supported = {'heading', 'paragraph', 'list', 'math', 'inline_math',
                 'footnote', 'table', 'figure', 'hyperlink'}
    references, bookmarks = [], []
    for section in sections:
        if not isinstance(section, dict) or section.get('orientation') not in (
                'portrait', 'landscape'):
            raise ValueError('Every section needs portrait or landscape orientation.')
        if not isinstance(section.get('id'), str) or not isinstance(section.get('blocks'), list):
            raise ValueError('Every section needs an id and a blocks list.')
        for block in section['blocks']:
            if not isinstance(block, dict) or block.get('type') not in supported:
                raise ValueError(f'Unsupported report block: {block!r}')
            kind = block['type']
            if kind == 'heading' and block.get('level') not in (0, 1, 2, 3):
                raise ValueError('Heading level must be 0 (appendix), 1, 2 or 3.')
            if kind in ('math', 'inline_math'):
                if block.get('id') not in ids:
                    raise ValueError(f'Unknown equation id: {block.get("id")}')
                references.append(block['id'])
                if kind == 'math':
                    bookmark = block.get('bookmark')
                    if not isinstance(bookmark, str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,39}', bookmark):
                        raise ValueError('Display equations need valid Word bookmark names.')
                    bookmarks.append(bookmark)
    if len(references) != 6 or set(references) != set(ids):
        raise ValueError('The demo must place each of its six equations exactly once.')
    if len(bookmarks) != 5 or len(set(bookmarks)) != 5:
        raise ValueError('The demo requires five uniquely bookmarked display equations.')


def build(doc, content, output: Path):
    """Compose this report into a fresh document made from its .dotx."""
    _check_content(content)
    output = Path(output).resolve()
    if not output.is_dir():
        raise NotADirectoryError(output)
    for control in doc.ContentControls:
        if control.Tag in content['metadata']:
            control.Range.Text = content['metadata'][control.Tag]
    if not doc.Bookmarks.Exists('ReportBodyStart'):
        raise ValueError('The demo template needs the ReportBodyStart bookmark.')
    start = doc.Bookmarks.Item('ReportBodyStart').Range.Start
    doc.Range(start, doc.Content.End - 1).Delete()
    doc.Bookmarks.Add('ReportBodyStart', doc.Range(start, start))
    equations = {equation['id']: equation for equation in content['equations']}
    composer = Composer(doc)
    orientation = 'portrait'
    for index, section in enumerate(content['sections']):
        print(f"Rendering {section['id']}", flush=True)
        if index:
            if section['orientation'] != orientation:
                doc.Range(doc.Content.End - 1, doc.Content.End - 1).InsertBreak(2)
                doc.Sections.Last.PageSetup.Orientation = (
                    1 if section['orientation'] == 'landscape' else 0)
            else:
                doc.Range(doc.Content.End - 1, doc.Content.End - 1).InsertBreak(7)
        orientation = section['orientation']
        for block in section['blocks']:
            kind = block['type']
            if kind == 'heading':
                composer.paragraph(block['text'],
                                   -1 - block['level'] if block['level'] else 'Appendix Heading')
            elif kind == 'paragraph':
                composer.paragraph(block['text'])
            elif kind == 'list':
                composer.list(block['items'], block['ordered'])
            elif kind in ('math', 'inline_math'):
                composer.math(equations[block['id']], inline=kind == 'inline_math',
                              before=block.get('before', ''), after=block.get('after', ''),
                              bookmark=block.get('bookmark'), bold_symbol=block.get('boldSymbol'))
            elif kind == 'footnote':
                composer.footnote(block['token'], block['text'])
            elif kind == 'table':
                composer.table(block)
            elif kind == 'figure':
                composer.figure(draw_figure(block, output), width_mm=block['widthMm'],
                                bookmark=block['id'], caption=block['caption'])
            elif kind == 'hyperlink':
                composer.hyperlink(block['text'], block['url'])
    pending_math = composer.finish()
    for index, section in enumerate(doc.Sections, 1):
        if index > 1:
            section.Headers.Item(1).Range.Text = content['shortTitle']
        if index > 3:
            footer = section.Footers.Item(1)
            footer.PageNumbers.RestartNumberingAtSection = False
            footer.PageNumbers.NumberStyle = 0
    refresh(doc)
    return pending_math


def _numbered_blocks(content):
    return [block for section in content['sections'] for block in section['blocks']
            if block['type'] == 'math']


def _numbers(doc, content):
    return [doc.Bookmarks.Item(block['bookmark']).Range.Text
            for block in _numbered_blocks(content)]


def _fraction_references(doc):
    return [field.Result.Text for field in doc.Fields
            if field.Code.Text.strip().startswith('REF EqFraction ')]


def _require_equal(name, actual, expected):
    if actual != expected:
        raise ValueError(f'Demo report {name}: expected {expected!r}, got {actual!r}')


def validate(doc, content):
    """Read this saved/reopened report's structure; never modify the document."""
    _check_content(content)
    body = doc.Sections.Item(3).Range.Duplicate
    body.Collapse(1)
    ole_shapes = [shape for shape in doc.InlineShapes if shape.Type == 1]
    baseline = dict(pages=doc.ComputeStatistics(2), bodyStart=body.Information(3),
                    ommlCount=doc.OMaths.Count, tables=doc.Tables.Count,
                    figures=sum(shape.Type == 3 for shape in doc.InlineShapes),
                    mathTypeCount=sum(shape.OLEFormat.ProgID == 'Equation.DSMT4'
                                      for shape in ole_shapes),
                    embeddedObjectCount=len(ole_shapes), footnotes=doc.Footnotes.Count,
                    toc=doc.TablesOfContents.Count, contentControls=doc.ContentControls.Count,
                    orientations=[section.PageSetup.Orientation for section in doc.Sections])
    baseline['bodyPages'] = baseline['pages'] - baseline['bodyStart'] + 1
    baseline['numbers'] = _numbers(doc, content)
    baseline['fractionReferences'] = _fraction_references(doc)
    expected = dict(pages=12, bodyStart=3, bodyPages=10, ommlCount=0,
                    tables=5, figures=2, mathTypeCount=6, embeddedObjectCount=6,
                    footnotes=1, toc=1, contentControls=5,
                    orientations=[0, 0, 0, 1, 0],
                    numbers=[f'3-{index}' for index in range(1, 6)],
                    fractionReferences=['3-1', '3-1'])
    for name, value in expected.items():
        _require_equal(name, baseline[name], value)
    if re.search(r'@(MATH|FIELD|NUMSTART|NUMEND)', doc.Content.Text):
        raise ValueError('Unresolved formula or numbering placeholders remain.')
    for block in _numbered_blocks(content):
        shape = doc.Bookmarks.Item('MT_' + block['id'].replace('-', '_')).Range.InlineShapes.Item(1)
        fields = [field for field in shape.Range.Paragraphs.Item(1).Range.Fields
                  if field.Code.Text.strip().startswith(('STYLEREF ', 'SEQ Equation '))]
        if len(fields) != 2 or any(field.Locked for field in fields):
            raise ValueError(f'{block["id"]}: expected two live equation-number fields.')
    baseline['status'] = 'passed'
    return baseline


def validate_editing(doc, content):
    """Insert/delete one temporary numbered row in an unsaved, isolated reopen.

    The caller must close this document without saving even if a check fails.
    This checks field editing; it does not claim internal MathType-object editing.
    """
    _check_content(content)
    first = doc.Bookmarks.Item('MT_eq_fraction').Range.Paragraphs.Item(1).Range.Start
    inserted = '\t编号验证\t(@CHECKCH@-@CHECKSEQ@)\r'
    doc.Range(first, first).InsertBefore(inserted)
    doc.Range(first, first + utf16_length(inserted)).Style = doc.Styles.Item('Equation')
    for marker, code in [('@CHECKCH@', r'STYLEREF 1 \s'),
                         ('@CHECKSEQ@', r'SEQ Equation \* ARABIC \s 1')]:
        target = doc.Content.Duplicate
        if not target.Find.Execute(FindText=marker, Wrap=0):
            raise RuntimeError(f'Numbering test marker missing: {marker}')
        doc.Fields.Add(target, -1, code, False)
    refresh(doc)
    inserted_numbers, inserted_refs = _numbers(doc, content), _fraction_references(doc)
    _require_equal('numbers after insertion', inserted_numbers, [f'3-{index}' for index in range(2, 7)])
    _require_equal('references after insertion', inserted_refs, ['3-2', '3-2'])
    # A collapsed range at a paragraph boundary can select the preceding
    # paragraph. Locate text inside the inserted row before removing it.
    temporary = doc.Content.Duplicate
    if not temporary.Find.Execute(FindText='编号验证', Wrap=0):
        raise RuntimeError('Temporary numbering row missing before deletion.')
    temporary.Paragraphs.Item(1).Range.Delete()
    refresh(doc)
    restored_numbers, restored_refs = _numbers(doc, content), _fraction_references(doc)
    _require_equal('numbers after deletion', restored_numbers, [f'3-{index}' for index in range(1, 6)])
    _require_equal('references after deletion', restored_refs, ['3-1', '3-1'])
    return dict(status='passed', saved=False,
                afterInsertion=dict(numbers=inserted_numbers, fractionReferences=inserted_refs),
                afterDeletion=dict(numbers=restored_numbers, fractionReferences=restored_refs))


def validate_pdf(texts, content):
    """Check demo-specific PDF invariants; visual review remains a separate step."""
    _check_content(content)
    if not isinstance(texts, list) or not all(isinstance(text, str) for text in texts):
        raise TypeError('PDF page texts must be a list of strings.')
    _require_equal('PDF pages', len(texts), content['expectedBodyPages'] + 2)
    text = '\n'.join(texts)
    # This demo has no literal backslashes. PDF extraction can separate a red
    # TeX backslash from the command, so an adjacent-command regexp misses it.
    if '\\' in text:
        raise ValueError('Demo PDF contains unparsed TeX commands; API success is insufficient.')
    compact = re.sub(r'\s+', '', text)
    numbers = [f'(3-{index})' for index in range(1, 6)]
    for number in numbers:
        if number not in compact:
            raise ValueError(f'Demo PDF equation number missing: {number}')
    return dict(status='passed', pages=len(texts), numbers=numbers,
                unparsedTex=False, visualReview='required')
