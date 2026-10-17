"""Validate the portable input before starting Word; no COM dependency."""
from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker
from PIL import Image

from .mathtype import mathtype_tex

ROOT = Path(__file__).resolve().parents[2]


def read_json(path):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f"Duplicate JSON key: {key}")
            result[key] = value
        return result
    def constant(token):
        raise ValueError(f"Invalid JSON constant: {token}")
    return json.loads(Path(path).read_text(encoding="utf-8"),
                      object_pairs_hook=pairs, parse_constant=constant)


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def bookmark(identifier, suffix=""):
    """Word IDs are case-insensitive and limited to 40 characters."""
    return "DR_" + sha256(identifier.encode("utf-8")).hexdigest()[:28] + suffix


def require(condition, message):
    if not condition:
        raise ValueError(message)


def table_grid(table):
    """Resolve omitted covered slots to logical coordinates before COM merges."""
    rows, cols = len(table["rows"]), len(table["columns"])
    require(cols <= 63, f"{table['id']}: Word supports at most 63 table columns")
    require(table["headerRows"] < rows, f"{table['id']}: headerRows must leave a body row")
    grid = [[False] * cols for _ in range(rows)]
    placements = []
    for r, row in enumerate(table["rows"]):
        for cell in row["cells"]:
            empty = [c for c in range(cols) if not grid[r][c]]
            require(empty, f"{cell['id']}: extra cell")
            c = empty[0]
            rs, cs = cell.get("rowSpan", 1), cell.get("colSpan", 1)
            require(r + rs <= rows and c + cs <= cols, f"{cell['id']}: span out of bounds")
            require(not r < table["headerRows"] < r + rs, f"{cell['id']}: span crosses header boundary")
            for rr in range(r, r + rs):
                for cc in range(c, c + cs):
                    require(not grid[rr][cc], f"{cell['id']}: overlapping spans")
                    grid[rr][cc] = True
            placements.append((r, c, rs, cs, cell))
    require(all(all(row) for row in grid), f"{table['id']}: table has uncovered grid slots")
    return placements


def validate_content(content, directory):
    schema = read_json(ROOT / "schema.json")
    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(content))
    if errors:
        error = min(errors, key=lambda x: len(x.absolute_path))
        path = "/".join(str(x) for x in error.absolute_path)
        raise ValueError(f"content.json/{path}: {error.message}")
    objects = list(walk(content))
    ids = [x["id"] for x in objects if "id" in x]
    duplicates = [key for key, count in Counter(ids).items() if count > 1]
    require(not duplicates, f"Duplicate IDs: {duplicates}")
    indexed = {x["id"]: x for x in objects if "id" in x}
    abstracts = [x for x in objects if x.get('type') == 'abstract']
    require(len(abstracts) <= 1, 'At most one abstract is supported')
    if abstracts:
        abstract = abstracts[0]
        require(content['blocks'][0] is abstract, 'The abstract must be the first top-level block')
        require(all(word == word.strip() and word for word in abstract['keywords']),
                f"{abstract['id']}: keywords must not have leading or trailing whitespace")
        require(all(p['content'] for p in abstract['paragraphs']),
                f"{abstract['id']}: abstract paragraphs must not be empty")
    notes = {x["id"]: x for x in content.get("notes", [])}
    references = {x["id"]: x for x in content.get("references", [])}
    note_uses = Counter()
    citation_order = []
    for obj in objects:
        kind, ident = obj.get("type"), obj.get("id", "content")
        if kind == "ref":
            target = indexed.get(obj["target"], {})
            require(target.get("type") in ("section", "figure", "table", "equation"), f"{ident}: invalid reference target")
            if target["type"] == "equation":
                require(target["numbered"] and obj["display"] != "title", f"{ident}: equation has no requested label")
            if target["type"] == "section" and target["numbering"] == "none":
                require(obj["display"] == "title", f"{ident}: section is not numbered")
            if target["type"] == "table" and not target["numbered"]:
                require(obj["display"] == "title", f"{ident}: table is not numbered")
            if obj["display"] == "title" and target["type"] in ("figure", "table"):
                require(target.get("caption") and all(x["type"] in ("text", "break") for x in target["caption"]),
                        f"{ident}: title reference requires a plain caption")
        elif kind == "note_ref":
            require(obj["target"] in notes, f"{ident}: unknown note")
            note_uses[obj["target"]] += 1
        elif kind == "cite":
            require(all(x in references for x in obj["targets"]), f"{ident}: unknown bibliography entry")
            citation_order.extend(x for x in obj["targets"] if x not in citation_order)
        elif kind in ("math", "equation"):
            latex = obj["latex"].strip()
            require(not latex.startswith(("$", r"\(", r"\[")), f"{ident}: omit math delimiters")
            require(not re.search(r"\\(?:tag|label|documentclass)\b|\\begin\s*\{document\}", latex), f"{ident}: omit manual numbering/document commands")
            mathtype_tex(latex)
        elif kind == "table":
            table_grid(obj)
        if kind == "link" or "url" in obj:
            url = urlsplit(obj.get("href", obj.get("url")))
            require(url.scheme in ("https", "http") and url.hostname, f"{ident}: invalid URL")
            _ = url.port
    require(all(note_uses[k] == 1 for k in notes), "Each note must have exactly one note_ref")
    require(not any(x.get("type") == "note_ref" for note in notes.values() for x in walk(note)), "Nested notes are not supported")
    bib_count = sum(x.get("type") == "bibliography" for x in objects)
    require(bib_count <= 1 and (not references or bib_count == 1), "A reference list needs exactly one bibliography block")
    citation_order = []
    def reading_order(value):
        if isinstance(value, dict):
            yield value
            if value.get('type') == 'note_ref':
                yield from reading_order(notes[value['target']]['blocks'])
            for child in value.values():
                yield from reading_order(child)
        elif isinstance(value, list):
            for child in value:
                yield from reading_order(child)
    for node in reading_order(content['blocks']):
        if node.get('type') == 'cite':
            citation_order.extend(x for x in node['targets'] if x not in citation_order)
    citation_order.extend(x for x in references if x not in citation_order)

    def blocks(items, depth=0, chapter=None, parent=None, tables=0):
        appendix_seen = False
        for item in items:
            kind = item["type"]
            if kind == "section":
                require(depth < 6, f"{item['id']}: at most six heading levels")
                mode = item["numbering"]
                require(mode != "appendix" or depth == 0, "Appendices must be top-level sections")
                require(parent != "none" or mode == "none", "Numbered section inside unnumbered section")
                if depth == 0:
                    require(not (appendix_seen and mode == "decimal"), "Main chapter after appendix")
                    appendix_seen |= mode == "appendix"
                scope = item["id"] if depth == 0 and mode != "none" else chapter
                blocks(item["children"], depth + 1, scope, mode, tables)
            elif kind == "equation" and item["numbered"]:
                require(chapter is not None, f"{item['id']}: numbered equation outside a chapter")
            elif kind == "table":
                require(tables < 6, f"{item['id']}: Word renderer supports at most six table levels")
                for row in item["rows"]:
                    for cell in row["cells"]:
                        blocks(cell["blocks"], depth, chapter, parent, tables + 1)
            elif kind == "list":
                for child in item["items"]:
                    blocks(child["blocks"], depth, chapter, parent, tables)
    blocks(content["blocks"])

    directory = Path(directory).resolve()
    base = (directory / "assets").resolve()
    require(base.is_relative_to(directory), "Asset root escapes report directory")
    normalized, assets = {}, {}
    for obj in objects:
        if obj.get("type") != "figure":
            continue
        raw = obj["src"]
        parts = raw.split("/")
        require(parts[0] == "assets" and all(p and p not in (".", "..") for p in parts), f"{obj['id']}: invalid asset path")
        for part in parts:
            require(not part.endswith((".", " ")), f"{obj['id']}: invalid filename")
            require(not any(ch in '<>:"\\|?*%#' or unicodedata.category(ch) == 'Cc' for ch in part), f"{obj['id']}: invalid filename")
            require(not re.fullmatch(r'CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]|CONIN\$|CONOUT\$', part.split('.')[0], re.I), f"{obj['id']}: reserved filename")
        key = unicodedata.normalize("NFC", raw).casefold()
        require(key not in normalized or normalized[key] == raw, "Asset names collide on Windows")
        normalized[key] = raw
        path = (directory / raw).resolve()
        require(path.is_relative_to(base) and path.is_file(), f"{obj['id']}: missing or escaped asset {raw}")
        with Image.open(path) as image:
            require(image.format == ("PNG" if path.suffix == ".png" else "JPEG"), f"{obj['id']}: image encoding does not match extension")
            image.verify()
        assets[obj["id"]] = path
    return dict(index=indexed, assets=assets, citations=citation_order)


def validate_layout(layout, content):
    require(isinstance(layout, dict), 'LAYOUT must be an ID-keyed dictionary')
    indexed = {x['id']: x for x in walk(content) if 'id' in x}
    abstract_paragraphs = {p['id'] for x in content['blocks'] if x['type'] == 'abstract'
                           for p in x['paragraphs']}
    kinds = {'paragraph': {'style'}, 'figure': {'widthMm'},
             'table': {'widthsMm', 'minRowHeightPt'},
             'section': {'pageBreakBefore', 'orientation'}}
    top = {x['id'] for x in content['blocks'] if x['type'] == 'section'}
    for ident, props in layout.items():
        require(ident in indexed, f'Unknown layout ID: {ident}')
        require(ident not in abstract_paragraphs or not props,
                f'{ident}: abstract paragraphs use dedicated abstract styles')
        kind = indexed[ident].get('type')
        require(isinstance(props, dict) and set(props) <= kinds.get(kind, set()), f'{ident}: invalid layout keys')
        if kind == 'section':
            require(ident in top, f'{ident}: section page layout applies to top-level sections')
        for key, value in props.items():
            if key == 'pageBreakBefore': require(isinstance(value, bool), f'{ident}: pageBreakBefore must be boolean')
            elif key == 'orientation': require(value in ('portrait', 'landscape'), f'{ident}: invalid orientation')
            elif key == 'style': require(isinstance(value, str) and value, f'{ident}: style must be a name')
            else:
                values = value if key == 'widthsMm' else [value]
                require(isinstance(values, list) and all(isinstance(x, (int,float)) and not isinstance(x,bool) and math.isfinite(x) and x > 0 for x in values), f'{ident}: dimensions must be finite positive numbers')
                if key == 'widthsMm': require(len(values) == len(indexed[ident]['columns']), f'{ident}: wrong number of column widths')
