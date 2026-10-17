"""读样本的 content.json；keep 不为 0 时每章只留前 keep 个子块，指到样本外的引用改成文字。"""
import json
from pathlib import Path


def trimmed_content(sample: Path, keep: int):
    content = json.loads((sample / 'content.json').read_text(encoding='utf-8'))
    if not keep:
        return content
    for block in content['blocks']:
        if block['type'] == 'section':
            block['children'] = block['children'][:keep]
    kept = set()

    def collect(value):
        if isinstance(value, list):
            for item in value:
                collect(item)
        elif isinstance(value, dict):
            if isinstance(value.get('id'), str):
                kept.add(value['id'])
            for item in value.values():
                collect(item)

    def rewrite(value):
        if isinstance(value, list):
            for index, item in enumerate(value):
                if isinstance(item, dict) and item.get('type') == 'ref' and item['target'] not in kept:
                    value[index] = {'type': 'text', 'text': '第 x 节'}
                rewrite(value[index])
        elif isinstance(value, dict):
            for item in value.values():
                rewrite(item)

    collect(content['blocks'])
    rewrite(content['blocks'])
    return content
