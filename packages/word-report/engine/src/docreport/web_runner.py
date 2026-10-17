"""Own the website renderer lock independently of the Node service lifetime."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
import uuid

from .__main__ import build, require_environment
from .content import read_json


def claim_lock(lock, job):
    lock = Path(lock).resolve()
    if not re.fullmatch(r'web-[a-f0-9-]{36}', job):
        raise ValueError('Invalid website job identifier.')
    owner = read_json(lock)
    if owner.get('id') != job or owner.get('phase') != 'starting' or owner.get('rendererPid') is not None:
        raise ValueError('Website job no longer owns an unclaimed renderer lock.')
    if not isinstance(owner.get('ownerPid'), int) or owner['ownerPid'] <= 0:
        raise ValueError('Website lock has no valid owner PID.')
    owner.update(pid=os.getpid(), rendererPid=os.getpid(), phase='rendering',
                 claimedAt=datetime.now(timezone.utc).isoformat())
    temporary = lock.with_name(lock.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temporary.open('x', encoding='utf-8') as stream:
            json.dump(owner, stream)
            stream.flush()
            os.fsync(stream.fileno())
        # Node never reclaims an orphan startup lock: this handoff cannot race
        # automatic stale-lock deletion, and a newer job must have another ID.
        current = read_json(lock)
        if current.get('id') != job or current.get('phase') != 'starting':
            raise ValueError('Renderer lock changed during ownership handoff.')
        os.replace(temporary, lock)
    finally:
        temporary.unlink(missing_ok=True)


def release_lock(lock, job):
    lock = Path(lock)
    try:
        owner = read_json(lock)
    except FileNotFoundError:
        return
    if owner.get('id') == job and owner.get('rendererPid') == os.getpid():
        lock.unlink(missing_ok=True)


def run(directory, output, lock, job, *, layout_path=None):
    require_environment()
    claim_lock(lock, job)
    try:
        return build(directory, output, data_only=True, layout_path=layout_path)
    finally:
        # Closing the Node server must not drop an active COM renderer's lock.
        # build() closes only its isolated Word instances before this finally.
        release_lock(lock, job)


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lock', type=Path, required=True)
    parser.add_argument('--job', required=True)
    parser.add_argument('report_directory', type=Path)
    parser.add_argument('--data-only', action='store_true', required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--layout', type=Path)
    args = parser.parse_args()
    try:
        output = run(args.report_directory, args.out, args.lock, args.job, layout_path=args.layout)
    except Exception as error:
        print(f'docreport web runner: {error}', file=sys.stderr)
        return 1
    print(output)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
