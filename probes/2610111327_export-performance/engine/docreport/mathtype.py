"""MathType OLE through its installed 64-bit API; no keyboard automation.

ABI: MathType Commands 2016.dotm / Declarations64.bas and MTTeXToggle.bas.
The tested language exchange supports ASCII TeX; API acceptance still needs
visual review because MathType can display unsupported commands literally.
"""
import ctypes as ct
from pathlib import Path
import re
import struct
import json
import os
import posixpath
from uuid import uuid4
from xml.etree import ElementTree as ET
from copy import deepcopy
from hashlib import sha256

from .word import find_text

DEFAULT_DLL = Path(r"C:\Program Files (x86)\MathType\MathPage\64\MathPage.wll")

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
PKG = 'http://schemas.microsoft.com/office/2006/xmlPackage'
REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
RID = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
for prefix, namespace in [('pkg', PKG), ('w', W), ('r', RID), ('v', 'urn:schemas-microsoft-com:vml'),
                          ('o', 'urn:schemas-microsoft-com:office:office'), ('pr', REL)]:
    ET.register_namespace(prefix, namespace)


def equation_packet(xml):
    """Keep one editable OLE object/preview without source text or bookmarks.

    Preserve Word's native package envelope. Cache entries are restricted to the
    same template and rendering environment; the new body has no paragraph style
    or numbering and contains only the formula object.
    """
    root = ET.fromstring(xml)
    parts = {p.get('{' + PKG + '}name'): p for p in root}
    source = parts['/word/document.xml'].find('{' + PKG + '}xmlData')
    objects = source.findall('.//{' + W + '}object')
    ole = source.findall('.//{urn:schemas-microsoft-com:office:office}OLEObject')
    if len(objects) != 1 or len(ole) != 1 or ole[0].get('ProgID') != 'Equation.DSMT4':
        raise ValueError('Cache packet must contain exactly one MathType object.')
    if ole[0].get('Type') != 'Embed':
        raise ValueError('Only embedded formulas may be cached.')
    used = {value for node in objects[0].iter() for key, value in node.attrib.items()
            if key == '{' + RID + '}id'}
    if not ole[0].get('{' + RID + '}id'):
        raise ValueError('MathType payload relationship is missing.')
    body = ET.Element('{' + W + '}body')
    paragraph = ET.SubElement(body, '{' + W + '}p')
    ET.SubElement(paragraph, '{' + W + '}r').append(deepcopy(objects[0]))
    source_rels = parts['/word/_rels/document.xml.rels'].find('{' + PKG + '}xmlData')[0]
    found = set()
    for rel in source_rels:
        if rel.get('Id') not in used:
            continue
        if rel.get('TargetMode') == 'External':
            raise ValueError('Formula cache cannot contain external references.')
        target = posixpath.normpath(posixpath.join('/word', rel.get('Target', '')))
        if target not in parts or not target.startswith(('/word/media/', '/word/embeddings/')):
            raise ValueError('Formula payload or preview missing from packet.')
        found.add(rel.get('Id'))
    if found != used:
        raise ValueError('Formula relationships are incomplete.')
    # Word rejects a freshly synthesized minimal Flat OPC package for OLE.
    # Preserve its native package envelope and namespace declarations, replacing
    # only the range body. The body contains no source styles or bookmarks.
    packet, count = re.subn(r'<w:body(?:\s[^>]*)?>.*?</w:body>',
                            lambda _: ET.tostring(body, encoding='unicode'), xml, count=1, flags=re.S)
    if count != 1:
        raise ValueError('Word range packet has no body.')
    return packet


def preferences_fingerprint():
    """Hash MathType rendering preferences, never log their values."""
    import winreg
    entries = []
    def visit(path):
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, path)
        except FileNotFoundError:
            entries.append((path, None))
            return
        with key:
            children, values, _ = winreg.QueryInfoKey(key)
            for index in range(values):
                name, value, kind = winreg.EnumValue(key, index)
                entries.append((path, name, repr(value), kind))
            for name in sorted(winreg.EnumKey(key, i) for i in range(children)):
                visit(path + '\\' + name)
    for name in ('Colors', 'Config', 'Functions', 'Matrix', 'Sizes', 'Spacing', 'Styles'):
        visit(r'Software\Design Science\DSMT7' + '\\' + name)
    return sha256(repr(sorted(entries)).encode()).hexdigest()


def registered_server_fingerprint():
    """Read the registered OLE server, never recursively scan a DLL's parents."""
    import winreg
    with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r'Equation.DSMT4\CLSID') as key:
        clsid = winreg.QueryValueEx(key, None)[0]
    with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, 'CLSID\\' + clsid + r'\LocalServer32') as key:
        command = os.path.expandvars(winreg.QueryValueEx(key, None)[0]).strip()
    match = re.match(r'^(?:"([^"]+)"|(.+?\.exe))(?:\s|$)', command, re.IGNORECASE)
    if not match:
        raise ValueError('MathType OLE server registration has no executable path.')
    path = Path(match[1] or match[2]).resolve()
    return {str(path): sha256(path.read_bytes()).hexdigest()}


class EquationCache:
    """Content-addressed, verified MathType fragments under repository out/."""

    def __init__(self, directory, dll, template_hash, word):
        self.directory = Path(directory)
        self.environment = dict(version=1, dll=sha256(Path(dll).read_bytes()).hexdigest(),
                                bridge=sha256(Path(__file__).read_bytes()).hexdigest(),
                                template=template_hash, preferences=preferences_fingerprint(),
                                word=[str(word.Version), str(word.Build)])
        self.environment['mathTypeExecutables'] = registered_server_fingerprint()
        self.environment['fonts'] = [(str(p), p.stat().st_size, p.stat().st_mtime_ns)
            for folder in (Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts',
                           Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft/Windows/Fonts')
            if folder.is_dir() for p in sorted(folder.iterdir()) if p.is_file()]

    def key(self, item):
        value = dict(self.environment, tex=mathtype_tex(item['equation']['latex']),
                     kind=item['kind'], boldSymbol=item.get('boldSymbol'))
        return sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()

    def load(self, item):
        key = self.key(item)
        try:
            entry = json.loads((self.directory / (key + '.json')).read_text(encoding='utf-8'))
            packet = entry['packet']
            if entry['key'] != key or sha256(packet.encode()).hexdigest() != entry['sha256']:
                return None
            # Parse again to reject damaged or incomplete payloads before Word.
            equation_packet(packet)
            return packet
        except (OSError, ValueError, KeyError, TypeError, AttributeError, IndexError, ET.ParseError):
            return None

    def store(self, item, xml):
        key, packet = self.key(item), equation_packet(xml)
        entry = dict(key=key, packet=packet, sha256=sha256(packet.encode()).hexdigest())
        self.directory.mkdir(parents=True, exist_ok=True)
        temporary = self.directory / (key + '.' + uuid4().hex + '.tmp')
        temporary.write_text(json.dumps(entry, ensure_ascii=False), encoding='utf-8')
        os.replace(temporary, self.directory / (key + '.json'))


def equation_bookmark(identifier):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", identifier):
        raise ValueError(f"Invalid equation ID: {identifier!r}")
    if len(identifier) > 34:
        return "MT_" + sha256(identifier.encode()).hexdigest()[:32]
    return "MT_" + identifier.replace("-", "_")


def mathtype_tex(latex):
    if not isinstance(latex, str) or not latex.strip() or not latex.isascii():
        raise ValueError("The validated MathType bridge requires nonempty ASCII TeX.")
    begin, end = r"\begin{aligned}", r"\end{aligned}"
    if latex.startswith(begin) and latex.endswith(end):
        body = latex[len(begin):-len(end)]
        if any(row.count("&") != 1 for row in body.split(r"\\")):
            raise ValueError("Only two-column aligned formulas are supported by this adapter.")
        return r"\begin{array}{rl}" + body + r"\end{array}"
    return latex


def validate_pending(pending):
    """Reject ambiguous bookmarks and placeholders before opening MathType."""
    if not isinstance(pending, list):
        raise TypeError("report.build must return a list of pending equations.")
    tokens, bookmarks = set(), set()
    for item in pending:
        token = item["token"]
        equation = item["equation"]
        bookmark = equation_bookmark(equation["id"])
        mathtype_tex(equation["latex"])
        if not isinstance(token, str) or not token or token in tokens:
            raise ValueError(f"Equation placeholder must be nonempty and unique: {token!r}")
        if bookmark in bookmarks:
            raise ValueError(f"Each equation occurrence needs a distinct bookmark: {bookmark}")
        if item["kind"] not in ("math", "inline_math"):
            raise ValueError(f"Unknown equation placement: {item['kind']}")
        tokens.add(token)
        bookmarks.add(bookmark)


def load_api(path):
    if struct.calcsize("P") != 8:
        raise RuntimeError("The MathType bridge requires 64-bit Python.")
    if not path.is_file():
        raise FileNotFoundError(f"MathType API not found: {path}; use --mathtype-dll to select it.")
    lib = ct.WinDLL(str(path))
    signatures = {
        "MTInitAPI": [ct.c_short, ct.c_short],
        "MTTermAPI": [],
        "MTIsFullFunctionality": [ct.c_short],
        "MTGetAppFunctionality": [],
        "MTSetEqnFromLangStr": [ct.c_void_p, ct.c_short, ct.c_void_p, ct.c_long],
        "MTGetLangStrFromEqn": [ct.c_void_p, ct.c_short, ct.c_void_p, ct.POINTER(ct.c_long)],
        "MTCloseOleObject": [ct.c_long, ct.c_void_p],
    }
    for name, params in signatures.items():
        function = getattr(lib, name)
        function.argtypes, function.restype = params, ct.c_long
    return lib


def operate_equation(lib, record, shape, stage, expected, replacement=None):
    """Write only fresh OLE objects; the setter can append to populated objects."""
    shape.OLEFormat.DoVerb(0)
    obj = shape.OLEFormat.Object
    pointer = ct.cast(getattr(obj, '_comobj', obj), ct.c_void_p)
    try:
        if replacement is not None:
            data = ct.create_unicode_buffer(replacement)
            rc = lib.MTSetEqnFromLangStr(pointer, 1, data,
                                       len(replacement.encode("utf-16-le")) // 2)
            record("write-tex", stage=stage, returnCode=rc, text=replacement)
            if rc != 0:
                raise RuntimeError(f"{stage}: MathType write failed: {rc}")
        length = ct.c_long(0)
        rc = lib.MTGetLangStrFromEqn(pointer, 1, None, ct.byref(length))
        if rc != 0 or not 0 < length.value < 1_000_000:
            raise RuntimeError(f"{stage}: invalid MathType read result: {rc}, {length.value}")
        buffer = ct.create_string_buffer(length.value * 4 + 16)
        rc = lib.MTGetLangStrFromEqn(pointer, 1, buffer, ct.byref(length))
        text = buffer.value.decode("ascii")
        matched = rc == 0 and text.strip().strip("$") == expected
        record("read-tex", stage=stage, returnCode=rc, text=text, matchesExpected=matched)
        if not matched:
            raise RuntimeError(f"{stage}: equation content differs from expected")
    finally:
        rc = lib.MTCloseOleObject(1, pointer)
        record("close-ole", stage=stage, returnCode=rc)
        if rc != 0:
            raise RuntimeError(f"{stage}: MathType close failed: {rc}")


def fill_and_reopen(draft, destination, pending, record, dll=DEFAULT_DLL, *, cache_directory=None, template_hash=''):
    import comtypes.client
    import comtypes.automation

    validate_pending(pending)
    if destination.exists():
        raise FileExistsError(destination)
    lib, word, initialized = load_api(dll), None, False
    try:
        rc = lib.MTInitAPI(0, 15)
        if rc < 0:
            raise RuntimeError(f"MTInitAPI failed: {rc}")
        initialized = True
        full, mode = lib.MTIsFullFunctionality(0), lib.MTGetAppFunctionality()
        record("mathtype-functionality", full=full, mode=mode, dll=str(dll))
        if full != 1:
            raise RuntimeError("MathType full functionality is required.")
        word = comtypes.client.CreateObject("Word.Application", dynamic=True)
        word.Visible, word.DisplayAlerts, word.AutomationSecurity = False, 0, 3
        missing = comtypes.automation.VARIANT.missing
        cache = EquationCache(cache_directory, dll, template_hash, word) if cache_directory else None
        created = set()
        doc = word.Documents.Open(str(draft), False, False, False)
        for item in pending:
            equation = item["equation"]
            tex = mathtype_tex(equation["latex"])
            if tex != equation["latex"]:
                record("tex-adaptation", id=equation["id"], sourceTex=equation["latex"], mathTypeTex=tex)
            target = find_text(doc, item["token"])
            target.Text = ""
            packet = cache.load(item) if cache else None
            if packet is not None:
                start = target.Start
                paragraph_style = target.Style.NameLocal
                paragraph_format = target.ParagraphFormat.Duplicate
                story = target.Duplicate
                story.Expand(6)  # wdStory: keep footnote/main-body coordinates separate.
                before_end = story.End
                target.InsertXML(packet)
                story.Start = start
                shape = story.InlineShapes.Item(1)
                object_range = shape.Range
                added = story.End - before_end - (object_range.End - object_range.Start)
                if added == 1:
                    tail = object_range.Duplicate
                    tail.SetRange(object_range.End, object_range.End + 1)
                    if tail.Text != '\r':
                        raise RuntimeError('Unexpected text after cached MathType object.')
                    tail.Delete()
                elif added != 0:
                    raise RuntimeError('Cached MathType fragment changed its paragraph boundary.')
                object_range.Style = paragraph_style
                object_range.ParagraphFormat = paragraph_format
                record('equation-cache-hit', id=equation['id'])
            else:
                shape = doc.InlineShapes.AddOLEObject("Equation.DSMT4", missing, False, False,
                                                 missing, missing, missing, target)
                # Delimiters force TeX interpretation even for short symbols.
                operate_equation(lib, record, shape, equation["id"], tex, '$' + tex + '$')
                created.add(equation['id'])
            shape.AlternativeText = "MathType " + equation["id"]
            doc.Bookmarks.Add(equation_bookmark(equation["id"]), shape.Range)
            record("equation-created", id=equation["id"], inline=item["kind"] == "inline_math",
                   widthPt=shape.Width, heightPt=shape.Height)
        doc.SaveAs2(str(destination), 16)
        doc.Close(0)
        doc = word.Documents.Open(str(destination), False, True, False)
        if doc.OMaths.Count != 0:
            raise RuntimeError("The report still contains OMML equations.")
        for item in pending:
            equation = item["equation"]
            shape = doc.Bookmarks.Item(equation_bookmark(equation["id"])).Range.InlineShapes.Item(1)
            if shape.OLEFormat.ProgID != "Equation.DSMT4":
                raise RuntimeError(f"Wrong OLE class: {equation['id']}")
            operate_equation(lib, record, shape, "reopened-" + equation["id"], mathtype_tex(equation["latex"]))
            if cache and equation['id'] in created:
                cache.store(item, shape.Range.WordOpenXML)
        doc.Close(0)
        record("mathtype-reopen", verified=len(pending))
    finally:
        try:
            if word is not None:
                try:
                    for index in range(word.Documents.Count, 0, -1):
                        word.Documents.Item(index).Close(0)
                finally:
                    word.Quit(0)
        finally:
            if initialized:
                rc = lib.MTTermAPI()
                record("terminate-api", returnCode=rc)
                if rc != 0:
                    raise RuntimeError(f"MTTermAPI failed: {rc}")
