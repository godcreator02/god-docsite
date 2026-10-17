"""Generic checks; each report supplies its own content and layout assertions."""
from hashlib import sha256
import re
import posixpath
from xml.etree import ElementTree as ET
from zipfile import ZipFile
from concurrent.futures import ProcessPoolExecutor
import os

from pypdf import PdfReader
from .word import story_ranges


def sha(path):
    return sha256(path.read_bytes()).hexdigest()


def document_state(doc, expected_equations):
    stories = list(story_ranges(doc))
    text = '\n'.join(story.Text for story in stories)
    if re.search(r"@(MATH|FIELD|NUMSTART|NUMEND|NOTE|LINK)\d+@", text):
        raise RuntimeError("Unresolved generation placeholders remain in the document.")
    count = sum(shape.Type == 1 and shape.OLEFormat.ProgID == "Equation.DSMT4"
                for story in stories for shape in story.InlineShapes)
    if doc.OMaths.Count != 0 or count != expected_equations:
        raise RuntimeError(f"Expected {expected_equations} MathType objects and no OMML; found {count}/{doc.OMaths.Count}.")
    return dict(pages=doc.ComputeStatistics(2), mathTypeObjects=count, ommlCount=doc.OMaths.Count,
                tables=doc.Tables.Count, figures=sum(shape.Type == 3 for shape in doc.InlineShapes),
                footnotes=doc.Footnotes.Count, toc=doc.TablesOfContents.Count,
                contentControls=doc.ContentControls.Count)


def abstract_state(doc, content):
    """Check the saved Word formatting promised by the abstract content type."""
    from .content import bookmark
    results = []
    for node in content.get('blocks', []):
        if node.get('type') != 'abstract':
            continue
        heading = doc.Bookmarks.Item(bookmark(node['id'], '_h')).Range
        keywords = doc.Bookmarks.Item(bookmark(node['id'], '_k')).Range
        block = doc.Bookmarks.Item(bookmark(node['id'], '_b')).Range
        expected_keywords = '关键词：' + '；'.join(node['keywords'])
        if (heading.ParagraphFormat.Alignment != 1 or heading.ListFormat.ListType != 0
                or abs(heading.ParagraphFormat.FirstLineIndent) > 0.01
                or keywords.ParagraphFormat.Alignment != 0
                or abs(keywords.ParagraphFormat.FirstLineIndent) > 0.01
                or abs(keywords.ParagraphFormat.CharacterUnitFirstLineIndent) > 0.01
                or abs(keywords.ParagraphFormat.LeftIndent) > 0.01
                or keywords.Text.rstrip('\r') != expected_keywords
                or block.Tables.Count != 0):
            raise RuntimeError(f"Abstract heading, keywords or table boundary failed: {node['id']}")
        for paragraph in node['paragraphs']:
            rng = doc.Bookmarks.Item(bookmark(paragraph['id'], '_b')).Range
            if rng.Style.NameLocal != 'DR Abstract Body':
                raise RuntimeError(f"Abstract paragraph style failed: {paragraph['id']}")
        results.append(dict(id=node['id'], paragraphs=len(node['paragraphs']), tables=0,
                            headingCentered=True, headingNumbered=False,
                            keywordsFirstLineIndentPt=keywords.ParagraphFormat.FirstLineIndent,
                            keywordsLeadingWhitespace=False))
    return results


def _check_field_results(root):
    w = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    stack, fields = [], []
    for node in root.iter():
        if node.tag == w+'fldSimple':
            fields.append((node.get(w+'instr', ''), ''.join(t.text or '' for t in node.iter(w+'t'))))
        elif node.tag == w+'fldChar':
            kind = node.get(w+'fldCharType')
            if kind == 'begin':
                stack.append(['', '', False])
            elif kind == 'separate' and stack:
                stack[-1][2] = True
            elif kind == 'end' and stack:
                code, result, _ = stack.pop()
                fields.append((code, result))
        elif stack and node.tag == w+'instrText' and not stack[-1][2]:
            stack[-1][0] += node.text or ''
        elif stack and node.tag == w+'t' and stack[-1][2]:
            stack[-1][1] += node.text or ''
    errors = ('错误!不能识别的开关参数', '错误!未找到引用源', '错误!找不到引用源', '错误!未定义书签',
              'error!unknownswitchargument', 'error!referencesourcenotfound', 'error!bookmarknotdefined')
    for code, result in fields:
        if re.sub(r'\s+', '', result).lower().replace('！', '!').startswith(errors):
            raise RuntimeError(f'Word field result error: {code.strip()}: {result}')


def package_state(path, expected_equations):
    with ZipFile(path) as archive:
        objects, omml = [], []
        for part in archive.namelist():
            if not part.startswith('word/') or not part.endswith('.xml'):
                continue
            root = ET.fromstring(archive.read(part))
            _check_field_results(root)
            found = [o for o in root.findall(".//{urn:schemas-microsoft-com:office:office}OLEObject")
                     if o.get("ProgID") == "Equation.DSMT4"]
            objects.extend(found)
            omml.extend(root.findall(".//{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath"))
            if found:
                folder, name = posixpath.split(part)
                relationships = ET.fromstring(archive.read(folder + '/_rels/' + name + '.rels'))
                targets = {r.get('Id'): r.get('Target') for r in relationships if r.get('TargetMode') != 'External'}
                for obj in found:
                    key = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
                    target = posixpath.normpath(folder + '/' + targets.get(obj.get(key), ''))
                    if not target.startswith('word/embeddings/') or target not in archive.namelist():
                        raise RuntimeError('Embedded MathType payload is missing from the DOCX.')
        if len(objects) != expected_equations or omml:
            raise RuntimeError("Saved DOCX equation structures differ from the report.")
        if any(o.get("Type") != "Embed" for o in objects):
            raise RuntimeError("MathType equations must be embedded, not linked.")
    return dict(mathTypeObjects=len(objects), ommlCount=len(omml), sha256=sha(path))


def content_state(path, content, directory):
    """Verify source text, nested table count and embedded image bytes after save."""
    from .content import walk, bookmark
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    with ZipFile(path) as archive:
        parts = [ET.fromstring(archive.read(p)) for p in archive.namelist()
                 if p.startswith('word/') and p.endswith('.xml') and '/glossary/' not in p]
        text = ''.join(t.text or '' for root in parts for t in root.findall('.//w:t', ns))
        compact = lambda s: re.sub(r'\s+', '', s)
        available = compact(text)
        nodes = list(walk(content))
        checked = 0
        for node in nodes:
            if node.get('type') in ('text', 'link'):
                if compact(node['text']) not in available:
                    raise RuntimeError(f"Source text missing after save: {node['text'][:100]}")
                checked += 1
            elif node.get('type') == 'abstract':
                keywords = '关键词：' + '；'.join(node['keywords'])
                if compact(node.get('title', '摘要')) not in available or compact(keywords) not in available:
                    raise RuntimeError(f"Abstract title or keywords missing after save: {node['id']}")
        tables = sum(len(root.findall('.//w:tbl', ns)) for root in parts)
        expected = sum(x.get('type') == 'table' for x in nodes)
        if tables != expected:
            raise RuntimeError(f'Expected {expected} tables including nested tables, found {tables}.')
        media_hashes = {sha256(archive.read(p)).hexdigest() for p in archive.namelist() if p.startswith('word/media/')}
        images = {x['src']: sha(directory/x['src']) for x in nodes if x.get('type') == 'figure'}
        if any(digest not in media_hashes for digest in images.values()):
            raise RuntimeError('Source image bytes are missing or transformed in DOCX.')
        fields = [f for root in parts for f in root.findall('.//w:instrText', ns)]
        def depth(element, level=0):
            level += element.tag == '{' + ns['w'] + '}tbl'
            return max([level] + [depth(child, level) for child in element])
        return dict(sourceTextRuns=checked, tablesIncludingNested=tables,
                    maximumTableDepth=max(depth(root) for root in parts),
                    sourceImages=images, fields=len(fields))


def _pdf_text_chunk(task):
    path, start, end = task
    pages = PdfReader(path).pages
    return [pages[index].extract_text() or '' for index in range(start, end)]


def pdf_state(path, expected_pages, *, workers=None):
    pages = PdfReader(path).pages
    if len(pages) != expected_pages:
        raise RuntimeError(f"Word reports {expected_pages} pages but PDF has {len(pages)}.")
    count = len(pages)
    workers = max(1, min(workers or os.cpu_count() or 1, 4, count or 1)) if count >= 16 else 1
    if workers == 1:
        texts = [page.extract_text() or '' for page in pages]
    else:
        size = (count + workers - 1) // workers
        tasks = [(str(path), start, min(start + size, count)) for start in range(0, count, size)]
        with ProcessPoolExecutor(max_workers=workers) as pool:
            texts = [text for chunk in pool.map(_pdf_text_chunk, tasks) for text in chunk]
    return dict(pages=count, sha256=sha(path), textWorkers=workers), texts


def native_text_state(path, content):
    """Check saved native run formatting in one package read.

    Applies to the generator's named paragraph/character styles; bookmarks
    select the same paragraphs as the former per-range COM checks. Field and
    MathType checks remain live Word checks in the caller.
    """
    from functools import lru_cache
    from .content import bookmark, walk
    W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    with ZipFile(path) as archive:
        styles_root = ET.fromstring(archive.read('word/styles.xml'))
        roots = [ET.fromstring(archive.read(name)) for name in archive.namelist()
                 if name.startswith('word/') and name.endswith('.xml')
                 and '/glossary/' not in name and name != 'word/styles.xml']
    styles = {s.get(W + 'styleId'): s for s in styles_root.findall(W + 'style')}
    default_id = next((ident for ident, s in styles.items()
                       if s.get(W + 'type') == 'paragraph' and s.get(W + 'default') == '1'), None)
    true = lambda element: element is not None and element.get(W + 'val', '1') not in ('0', 'false', 'off')

    def apply(state, properties, toggle=False):
        italic, script = state
        if properties is not None:
            i = properties.find(W + 'i')
            if i is not None:
                italic = (not italic if true(i) else italic) if toggle else true(i)
            vertical = properties.find(W + 'vertAlign')
            if vertical is not None:
                script = vertical.get(W + 'val', 'baseline')
        return italic, script

    defaults = apply((False, 'baseline'), styles_root.find(W + 'docDefaults/' + W + 'rPrDefault/' + W + 'rPr'))

    @lru_cache(None)
    def chain(ident, seen=()):
        if ident is None:
            return ()
        if ident in seen or ident not in styles:
            raise ValueError(f'Invalid style inheritance: {ident}')
        style = styles[ident]
        based = style.find(W + 'basedOn')
        return chain(based.get(W + 'val') if based is not None else None, seen + (ident,)) + (ident,)

    def inherited(state, ident):
        for key in chain(ident):
            state = apply(state, styles[key].find(W + 'rPr'), toggle=True)
        return state

    paragraphs = {}
    for root in roots:
        for p in root.iter(W + 'p'):
            names = [b.get(W + 'name') for b in p.iter(W + 'bookmarkStart')]
            if not names:
                continue
            pstyle = p.find(W + 'pPr/' + W + 'pStyle')
            base = inherited(defaults, pstyle.get(W + 'val') if pstyle is not None else default_id)
            chars, formats = [], []
            for run in p.iter(W + 'r'):
                props = run.find(W + 'rPr')
                rstyle = props.find(W + 'rStyle') if props is not None else None
                state = inherited(base, rstyle.get(W + 'val')) if rstyle is not None else base
                state = apply(state, props)
                text = ''.join((x.text or '') if x.tag == W + 't' else
                               '\t' if x.tag == W + 'tab' else
                               '\v' if x.tag in (W + 'br', W + 'cr') else '' for x in run)
                chars.append(text)
                formats.extend([state] * len(text))
            for name in names:
                paragraphs[name] = (''.join(chars), formats)
    checked = scripted = 0
    for node in walk(content):
        if node.get('type') != 'paragraph':
            continue
        actual = paragraphs.get(bookmark(node['id'], '_b'))
        if actual is None:
            continue  # List paragraphs have no independent body bookmark.
        text, formats = actual
        offset = 0
        for item in node['content']:
            if item['type'] != 'text':
                break
            value = item['text']
            if text[offset:offset + len(value)] != value:
                raise RuntimeError(f"Native text differs: {node['id']} {value!r}")
            marks = item.get('marks', [])
            expected = ('em' in marks, 'subscript' if 'sub' in marks else 'superscript' if 'sup' in marks else 'baseline')
            if any(state != expected for state in formats[offset:offset + len(value)]):
                raise RuntimeError(f"Native formatting differs: {node['id']} {value!r}")
            checked += 1
            scripted += bool({'sub', 'sup'} & set(marks))
            offset += len(value)
        for item in node['content']:
            marks = item.get('marks', [])
            if item['type'] != 'text' or not ({'sub', 'sup'} & set(marks)):
                continue
            value = item['text']
            script = 'subscript' if 'sub' in marks else 'superscript'
            offset = text.find(value)
            while offset >= 0:
                if all(state[1] == script for state in formats[offset:offset + len(value)]):
                    break
                offset = text.find(value, offset + 1)
            if offset < 0:
                raise RuntimeError(f"Scripted fragment missing: {node['id']} {value!r}")
    return dict(nativeTextRuns=checked, nativeScriptRuns=scripted)
