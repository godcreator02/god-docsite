"""Read software registration and executable visibility; do not start Office."""
import argparse
from datetime import datetime, timezone, timedelta
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import re
import shutil
import site
import subprocess
import sys
import uuid
import winreg

ROOT = Path(__file__).resolve().parents[1]


def reg_value(hive, key, name=''):
    try:
        with winreg.OpenKey(hive, key) as handle:
            return winreg.QueryValueEx(handle, name)[0]
    except FileNotFoundError:
        return None


def snapshot():
    installed = []
    for hive, key in [(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'),
                      (winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'),
                      (winreg.HKEY_CURRENT_USER, r'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')]:
        try:
            with winreg.OpenKey(hive, key) as handle:
                for index in range(winreg.QueryInfoKey(handle)[0]):
                    child = key + '\\' + winreg.EnumKey(handle, index)
                    name = reg_value(hive, child, 'DisplayName')
                    if name and re.search(r'MathType|Microsoft Office|Microsoft 365|Microsoft Word|Pandoc', name):
                        installed.append({field: reg_value(hive, child, field) for field in ['DisplayName', 'DisplayVersion', 'InstallLocation']})
        except FileNotFoundError:
            pass
    registrations = []
    for prog_id in ['Word.Application', 'Equation.DSMT4']:
        clsid = reg_value(winreg.HKEY_CLASSES_ROOT, prog_id + r'\CLSID')
        server = reg_value(winreg.HKEY_CLASSES_ROOT, f'CLSID\\{clsid}\\LocalServer32') if clsid else None
        match = re.match(r'\s*"?(.+?\.exe)"?(?:\s|$)', server, re.I) if server else None
        executable = match[1] if match else None
        registrations.append(dict(progId=prog_id, registered=bool(clsid), clsid=clsid, localServer=server,
                                  executablePath=executable, executableExists=bool(executable and Path(executable).is_file()), runtimeVerified=False))
    pandoc = shutil.which('pandoc')
    version = subprocess.check_output([pandoc, '--version'], text=True).splitlines()[0] if pandoc else None
    try:
        pywin32 = importlib.metadata.version('pywin32')
    except importlib.metadata.PackageNotFoundError:
        pywin32 = None
    return dict(recordedAt=datetime.now(timezone(timedelta(hours=8))).isoformat(), timeZone='Asia/Shanghai',
                pythonVersion=platform.python_version(), pythonExecutable=sys.executable, pywin32Version=pywin32,
                virtualEnvironment=dict(prefix=sys.prefix, basePrefix=sys.base_prefix,
                                        enabled=sys.prefix != sys.base_prefix,
                                        userSiteEnabled=site.ENABLE_USER_SITE),
                pythonPackages={name: dict(version=importlib.metadata.version(name),
                                          location=str(importlib.metadata.distribution(name).locate_file('')))
                                for name in ['pywin32', 'python-docx', 'lxml', 'pypdf', 'Pillow', 'typing_extensions']},
                osVersion=platform.platform(), installedSoftware=installed, comRegistrations=registrations,
                pandoc=dict(onPath=bool(pandoc), path=pandoc, version=version),
                fixtureSha256=hashlib.sha256((ROOT / 'fixtures/canonical.json').read_bytes()).hexdigest(),
                notes=['注册信息、程序存在与运行成功分别记录；本脚本不启动 Office 或 MathType。',
                       'PATH 未发现程序不等于全盘未安装；不采集许可证或其他凭据。'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output_directory', type=Path, nargs='?')
    args = parser.parse_args()
    run = args.output_directory or ROOT / 'out' / ('environment-' + datetime.now(timezone(timedelta(hours=8))).strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6])
    run.mkdir(parents=True, exist_ok=True)
    output = run / 'environment.json'
    with output.open('x', encoding='utf-8') as handle:
        json.dump(snapshot(), handle, ensure_ascii=False, indent=2)
    print(output.resolve())
