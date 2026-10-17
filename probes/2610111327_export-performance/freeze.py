"""Archive this experiment's code, fixed inputs and all small success/failure records."""
import json
from hashlib import sha256
from pathlib import Path
import shutil
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def main():
    records = []
    engine = HERE/'engine/docreport'
    engine.mkdir(parents=True, exist_ok=True)
    for source in sorted((ROOT/'src/docreport').glob('*.py')):
        text = source.read_text(encoding='utf-8')
        if source.name == '__main__.py':
            text = text.replace('ROOT = Path(__file__).resolve().parents[2]', 'ROOT = Path(__file__).resolve().parents[4]')
            text = text.replace('(ROOT / "src/docreport").glob', 'Path(__file__).resolve().parent.glob')
            text = text.replace('(ROOT / name) for name', '(Path(__file__).resolve().parents[2] / name) for name')
            text = text.replace("ROOT / 'schemas/report-content.schema.json'", "Path(__file__).resolve().parents[2] / 'schema.json'")
            text = text.replace("ROOT / 'templates/project-report.dotx'", "Path(__file__).resolve().parents[2] / 'template.dotx'")
        if source.name == 'content.py':
            text = text.replace('ROOT / "schemas/report-content.schema.json"', 'ROOT / "schema.json"')
        destination = engine/source.name
        destination.write_text(text, encoding='utf-8')
        records.append(dict(source=str(source.relative_to(ROOT)), sourceSha256=digest(source),
                            archived=str(destination.relative_to(HERE)), archivedSha256=digest(destination)))
    for source, target in [('requirements.txt','requirements.txt'), ('pyproject.toml','pyproject.toml'),
                           ('schemas/report-content.schema.json','schema.json'),
                           ('out/sst-full-render-r06/manifest.json','baseline-manifest.json')]:
        shutil.copy2(ROOT/source, HERE/target)
    fixed = HERE/'full-input'
    fixed.mkdir(exist_ok=True)
    source = ROOT/'out/sst-full-r01'
    for name in ('content.json','report.py','project-report-noimgcompress.dotx'):
        shutil.copy2(source/name, fixed/name)
    shutil.copytree(source/'assets', fixed/'assets', dirs_exist_ok=True)
    for folder in sorted((ROOT/'out').glob('perf-*')):
        if not folder.is_dir():
            continue
        for path in sorted(folder.rglob('*')):
            if not path.is_file() or '__pycache__' in path.parts:
                continue
            relative = path.relative_to(ROOT/'out')
            item = dict(source=str(path.relative_to(ROOT)), sha256=digest(path), bytes=path.stat().st_size)
            keep = (path.suffix in ('.json','.txt','.py','.xml','.log') and path.stat().st_size < 256000
                    and 'cache' not in path.relative_to(folder).parts)
            if keep:
                destination = HERE/'evidence'/relative
                if path.suffix == '.log':
                    destination = destination.with_suffix('.txt')
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, destination)
                item['archived'] = str(destination.relative_to(HERE))
            else:
                item['archived'] = False
            records.append(item)
    (HERE/'archive-manifest.json').write_text(json.dumps(dict(
        policy='Frozen engine differs only in paths for schema, dependencies, default template, venv/output root and source provenance. Large artifacts remain under out/ and are NOT Git archives.',
        files=records), ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(dict(records=len(records), archived=sum(bool(x.get('archived')) for x in records))))


if __name__ == '__main__':
    main()
