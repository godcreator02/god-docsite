"""Candidate saved-document formatting check, avoiding per-character COM reads."""
from functools import lru_cache
from xml.etree import ElementTree as ET
from zipfile import ZipFile
from frozen_content import bookmark, walk

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def native_text_state(path, content):
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
