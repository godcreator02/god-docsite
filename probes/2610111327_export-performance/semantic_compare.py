"""Compare every table cell and source-paragraph order against accepted DOCX."""
import argparse
import json
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
from docreport.content import walk, bookmark

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def snapshot(path, identifiers):
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read('word/document.xml'))
    tables = [[[''.join(t.text or '' for t in cell.iter(W+'t')) for cell in row.findall(W+'tc')]
               for row in table.findall(W+'tr')] for table in root.iter(W+'tbl')]
    order = [b.get(W+'name') for b in root.iter(W+'bookmarkStart') if b.get(W+'name') in identifiers]
    return tables, order


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--content', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.content.read_text(encoding='utf-8'))
    ids = {bookmark(n['id'], '_b') for n in walk(data) if n.get('type') == 'paragraph'}
    a, b = (snapshot(p, ids) for p in (args.baseline, args.candidate))
    result = dict(tableCount=len(a[0]), cells=sum(len(row) for table in a[0] for row in table),
                  tableCellsEqual=a[0] == b[0], sourceParagraphBookmarks=len(a[1]),
                  sourceParagraphOrderEqual=a[1] == b[1], passed=a == b)
    args.out.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
