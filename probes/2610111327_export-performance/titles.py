"""Check saved title-reference bookmark semantics, not only bookmark presence."""
import argparse
import json
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
from docreport.content import walk, bookmark

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def check(path, content):
    expected = {}
    for node in walk(content):
        if node.get('type') == 'section':
            expected[bookmark(node['id'], '_t')] = node['title']
        elif node.get('type') in ('figure', 'table') and node.get('caption'):
            if all(n['type'] in ('text', 'link') for n in node['caption']):
                expected[bookmark(node['id'], '_t')] = ''.join(n['text'] for n in node['caption'])
    active, found = {}, {}
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read('word/document.xml'))
    for element in root.iter():
        if element.tag == W+'bookmarkStart' and element.get(W+'name') in expected:
            active[element.get(W+'id')] = [element.get(W+'name'), '']
        elif element.tag == W+'t':
            for item in active.values():
                item[1] += element.text or ''
        elif element.tag == W+'bookmarkEnd' and element.get(W+'id') in active:
            name, text = active.pop(element.get(W+'id'))
            found[name] = text
    errors = [dict(name=name, expected=text, actual=found.get(name))
              for name, text in expected.items() if found.get(name) != text]
    return dict(checked=len(expected), passed=not errors, errors=errors)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--docx', type=Path, required=True)
    parser.add_argument('--content', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    result = check(args.docx, json.loads(args.content.read_text(encoding='utf-8')))
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=True))
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
