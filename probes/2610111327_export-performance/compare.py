"""Compare complete Word exports, including every rendered PDF pixel."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from xml.etree import ElementTree as ET
from zipfile import ZipFile
from PIL import Image, ImageChops
from pypdf import PdfReader

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def package(path):
    names, codes, pictures, toc_targets = set(), [], set(), {}
    with ZipFile(path) as archive:
        for name in archive.namelist():
            if name.startswith('word/media/') and name.endswith('.png'):
                pictures.add(hashlib.sha256(archive.read(name)).hexdigest())
            if not name.startswith('word/') or not name.endswith('.xml'):
                continue
            root = ET.fromstring(archive.read(name))
            for paragraph in root.iter(W + 'p'):
                starts = list(paragraph.iter(W + 'bookmarkStart'))
                source = sorted(b.get(W + 'name') for b in starts
                                if b.get(W + 'name', '').startswith('DR_'))
                for b in starts:
                    target = b.get(W + 'name', '')
                    if target.startswith('_Toc'):
                        # Word allocates new private names at every TOC rebuild.
                        # Compare their actual source-heading targets instead.
                        if not source:
                            raise ValueError(f'TOC target has no source heading: {target}')
                        toc_targets[target] = '|'.join(source)
            names.update(b.get(W + 'name') for b in root.iter(W + 'bookmarkStart')
                         if b.get(W + 'name', '').startswith('DR_'))
            stack = []
            for node in root.iter():
                if node.tag == W + 'fldSimple':
                    codes.append(node.get(W + 'instr', ''))
                elif node.tag == W + 'fldChar':
                    kind = node.get(W + 'fldCharType')
                    if kind == 'begin':
                        stack.append(['', True])
                    elif kind == 'separate' and stack:
                        stack[-1][1] = False
                    elif kind == 'end' and stack:
                        codes.append(stack.pop()[0])
                elif node.tag == W + 'instrText' and stack and stack[-1][1]:
                    stack[-1][0] += node.text or ''
    def normalized(code):
        code = re.sub(r'\s+', ' ', code).strip()
        return re.sub(r'\b_Toc\d+\b', lambda m: toc_targets[m[0]], code)
    return names, Counter(normalized(x) for x in codes), pictures


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--poppler', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    a, b = (package(p / 'report.docx') for p in (args.baseline, args.candidate))
    result = {'sourceBookmarksEqual': a[0] == b[0], 'sourceBookmarkCount': len(a[0]),
              'fieldCodesEqual': a[1] == b[1], 'fieldCount': sum(a[1].values()),
              'pngBytesEqual': a[2] == b[2], 'pngCount': len(a[2]),
              'baselinePdfSha256': hashlib.sha256((args.baseline/'report.pdf').read_bytes()).hexdigest(),
              'candidatePdfSha256': hashlib.sha256((args.candidate/'report.pdf').read_bytes()).hexdigest()}
    if a[1] != b[1]:
        result['missingFields'] = dict(a[1] - b[1]); result['addedFields'] = dict(b[1] - a[1])
    pages_a, pages_b = ([p.extract_text() for p in PdfReader(d/'report.pdf').pages]
                        for d in (args.baseline, args.candidate))
    result['pageCount'] = [len(pages_a), len(pages_b)]
    result['perPageTextEqual'] = pages_a == pages_b
    jobs = []
    started = time.perf_counter()
    for label, source, count in [('baseline', args.baseline, len(pages_a)), ('candidate', args.candidate, len(pages_b))]:
        folder = args.out / label
        folder.mkdir()
        size = max(1, (count + max(1, args.workers) - 1) // max(1, args.workers))
        for first in range(1, count + 1, size):
            jobs.append([str(args.poppler), '-f', str(first), '-l', str(min(first + size - 1, count)),
                         '-r', '110', '-png', str(source/'report.pdf'), str(folder/'page')])
    def render(command):
        subprocess.run(command, check=True, capture_output=True)
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
        list(pool.map(render, jobs))
    result['renderSeconds'] = round(time.perf_counter() - started, 3)
    result['renderWorkers'] = max(1, min(args.workers, 4))
    images_a, images_b = (sorted((args.out/x).glob('page-*.png')) for x in ('baseline', 'candidate'))
    diffs = []
    for i, (left, right) in enumerate(zip(images_a, images_b), 1):
        with Image.open(left) as x, Image.open(right) as y:
            bounds = ImageChops.difference(x.convert('RGB'), y.convert('RGB')).getbbox() if x.size == y.size else 'page size changed'
            if bounds is not None:
                diffs.append({'page': i, 'bounds': bounds})
    result['renderedPageCount'] = [len(images_a), len(images_b)]
    result['pixelDifferences'] = diffs
    result['passed'] = (all(result[k] for k in ('sourceBookmarksEqual', 'fieldCodesEqual', 'pngBytesEqual', 'perPageTextEqual'))
                        and len(images_a) == len(images_b) == len(pages_a) and not diffs)
    (args.out/'comparison.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
