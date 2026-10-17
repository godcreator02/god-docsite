"""Generic checks; each report supplies its own content and layout assertions."""
from hashlib import sha256
import re
import posixpath
from xml.etree import ElementTree as ET
from zipfile import ZipFile

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


WORD_NS = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
# Word writes these into a field's result when a REF/SEQ target or switch is broken; readers then see them as body text.
FIELD_ERROR_PREFIXES = ('错误!不能识别的开关参数', '错误!未找到引用源', '错误!找不到引用源', '错误!未定义书签',
                        'error!unknownswitchargument', 'error!referencesourcenotfound', 'error!bookmarknotdefined')


def field_results(root):
    """Yield (field code, displayed result) for every simple and complex field in one XML part."""
    open_fields = []  # [code, result, past separator] per nested complex field
    for node in root.iter():
        if node.tag == WORD_NS + 'fldSimple':
            yield node.get(WORD_NS + 'instr', ''), ''.join(t.text or '' for t in node.iter(WORD_NS + 't'))
        elif node.tag == WORD_NS + 'fldChar':
            kind = node.get(WORD_NS + 'fldCharType')
            if kind == 'begin':
                open_fields.append(['', '', False])
            elif kind == 'separate' and open_fields:
                open_fields[-1][2] = True
            elif kind == 'end' and open_fields:
                code, result, _ = open_fields.pop()
                yield code, result
        elif open_fields and node.tag == WORD_NS + 'instrText' and not open_fields[-1][2]:
            open_fields[-1][0] += node.text or ''
        elif open_fields and node.tag == WORD_NS + 't' and open_fields[-1][2]:
            open_fields[-1][1] += node.text or ''


def reject_field_error_results(root):
    for code, result in field_results(root):
        if re.sub(r'\s+', '', result).lower().replace('！', '!').startswith(FIELD_ERROR_PREFIXES):
            raise RuntimeError(f'Word field result error: {code.strip()}: {result}')


def package_state(path, expected_equations):
    with ZipFile(path) as archive:
        objects, omml = [], []
        for part in archive.namelist():
            if not part.startswith('word/') or not part.endswith('.xml'):
                continue
            root = ET.fromstring(archive.read(part))
            reject_field_error_results(root)
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
            elif node.get('type') == 'math' and 'plainText' in node:
                written = ''.join(run['text'] for run in node['plainText'])
                if compact(written) not in available:
                    raise RuntimeError(f"Inline formula text missing after save: {written[:100]}")
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


def pdf_state(path, expected_pages):
    pages = PdfReader(path).pages
    if len(pages) != expected_pages:
        raise RuntimeError(f"Word reports {expected_pages} pages but PDF has {len(pages)}.")
    texts = [page.extract_text() or "" for page in pages]
    return dict(pages=len(pages), sha256=sha(path)), texts
