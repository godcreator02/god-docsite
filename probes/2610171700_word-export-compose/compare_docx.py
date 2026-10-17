"""比对两份 docx 的正文与脚注：去掉 Word 每次随机生成的修订号、段落编号、书签编号与占位块 GUID 后逐字比
python compare_docx.py <a.docx> <b.docx>；相同退出码 0，不同打出前几处差异、退出码 1
"""
import re
import sys
import zipfile


def normalized(path):
    with zipfile.ZipFile(path) as archive:
        parts = {}
        for name in ('word/document.xml', 'word/footnotes.xml'):
            if name in archive.namelist():
                xml = archive.read(name).decode('utf-8')
                xml = re.sub(r' w:rsid\w*="[0-9A-F]+"', '', xml)
                xml = re.sub(r' w14:(?:paraId|textId)="[0-9A-F]+"', '', xml)
                xml = re.sub(r' wp14:(?:anchorId|editId)="[0-9A-F]+"', '', xml)
                xml = re.sub(r'(<w:bookmark(?:Start|End)[^>]*?) w:id="\d+"', r'\1', xml)
                xml = re.sub(r'<w:docPart w:val="[0-9A-F]+"/>', '<w:docPart/>', xml)
                # 目录的隐藏书签名是 Word 按计数器生成的：按出现顺序换成序号
                names = {}
                xml = re.sub(r'_Toc\d+', lambda m: names.setdefault(m.group(), f'_Toc#{len(names)}'), xml)
                parts[name] = xml
        return parts


a, b = normalized(sys.argv[1]), normalized(sys.argv[2])
different = False
for part in sorted(set(a) | set(b)):
    x, y = a.get(part, ''), b.get(part, '')
    if x == y:
        print(f'{part}：相同（{len(x)} 字符）')
        continue
    different = True
    print(f'{part}：不同')
    shown, at = 0, 0
    while shown < 3:
        at = next((i for i in range(at, min(len(x), len(y))) if x[i] != y[i]), None)
        if at is None:
            break
        print(f'  第 {at} 个字符起：\n    a {x[max(0, at - 150):at + 150]!r}\n    b {y[max(0, at - 150):at + 150]!r}')
        shown += 1
        at += 300
sys.exit(1 if different else 0)
