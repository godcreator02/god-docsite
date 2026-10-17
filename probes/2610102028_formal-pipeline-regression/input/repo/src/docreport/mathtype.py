"""MathType OLE through its installed 64-bit API; no keyboard automation.

ABI: MathType Commands 2016.dotm / Declarations64.bas and MTTeXToggle.bas.
The tested language exchange supports ASCII TeX; API acceptance still needs
visual review because MathType can display unsupported commands literally.
"""
import ctypes as ct
from pathlib import Path
import re
import struct

DEFAULT_DLL = Path(r"C:\Program Files (x86)\MathType\MathPage\64\MathPage.wll")


def equation_bookmark(identifier):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,33}", identifier):
        raise ValueError(f"Equation ID must be 1-34 ASCII letters/digits/_/-: {identifier!r}")
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
    pointer = ct.cast(obj._comobj, ct.c_void_p)
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


def fill_and_reopen(draft, destination, pending, record, dll=DEFAULT_DLL):
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
        doc = word.Documents.Open(str(draft), False, False, False)
        for item in pending:
            equation = item["equation"]
            tex = mathtype_tex(equation["latex"])
            if tex != equation["latex"]:
                record("tex-adaptation", id=equation["id"], sourceTex=equation["latex"], mathTypeTex=tex)
            target = doc.Content.Duplicate
            if not target.Find.Execute(item["token"]):
                raise RuntimeError(f"Missing equation placeholder: {item['token']}")
            point = target.Start
            target.Text = ""
            shape = doc.InlineShapes.AddOLEObject("Equation.DSMT4", missing, False, False,
                                                 missing, missing, missing, doc.Range(point, point))
            operate_equation(lib, record, shape, equation["id"], tex, tex)
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
