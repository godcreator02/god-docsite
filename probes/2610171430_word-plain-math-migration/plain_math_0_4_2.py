"""Inline TeX without layout structure becomes formatted Word text instead of a MathType object.

Letters, digits, Greek letters, one level of sub- or superscript, \\mathrm / \\text,
function names and simple operators map to runs styled the way TeX renders them:
Latin and lowercase Greek letters italic, everything else upright. Roots, fractions,
sums, accents, auto-sized delimiters, nested scripts and a sub- with a superscript on
one base need two-dimensional layout and stay with MathType (``plain_runs`` returns None).
"""
from dataclasses import dataclass

GREEK = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ϵ', 'varepsilon': 'ε',
    'zeta': 'ζ', 'eta': 'η', 'theta': 'θ', 'vartheta': 'ϑ', 'kappa': 'κ', 'lambda': 'λ',
    'mu': 'μ', 'nu': 'ν', 'xi': 'ξ', 'pi': 'π', 'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ',
    'phi': 'ϕ', 'varphi': 'φ', 'chi': 'χ', 'psi': 'ψ', 'omega': 'ω',
    'Gamma': 'Γ', 'Delta': 'Δ', 'Theta': 'Θ', 'Lambda': 'Λ', 'Xi': 'Ξ', 'Pi': 'Π',
    'Sigma': 'Σ', 'Phi': 'Φ', 'Psi': 'Ψ', 'Omega': 'Ω',
}
FUNCTIONS = {'sin', 'cos', 'tan', 'max', 'min', 'log', 'ln', 'exp', 'arctan', 'sgn'}
BINARY = {'cdot': '·', 'times': '×', 'pm': '±', 'mp': '∓'}
RELATIONS = {'approx': '≈', 'le': '≤', 'leq': '≤', 'ge': '≥', 'geq': '≥', 'ne': '≠', 'neq': '≠',
             'sim': '∼', 'to': '→', 'equiv': '≡', 'propto': '∝'}
SYMBOLS = {'infty': '∞', 'ldots': '…', 'cdots': '⋯', 'prime': '′', '%': '%', '#': '#', '&': None}
SPACES = {',': ' ', ';': ' ', ' ': ' ', 'quad': ' ', 'qquad': '  '}
THIN = ' '


@dataclass
class Run:
    text: str
    italic: bool = False
    script: str | None = None  # 'sub' or 'sup'


class NeedsMathType(Exception):
    pass


@dataclass
class Atom:
    runs: list
    kind: str  # ord, bin, rel, open, close, punct, op, space
    sub: bool = False
    sup: bool = False
    binary: bool = False  # a bin atom with an operand on its left, as opposed to a sign


class Parser:
    def __init__(self, tex):
        self.tex, self.at = tex, 0

    def peek(self):
        return self.tex[self.at] if self.at < len(self.tex) else ''

    def command(self):
        self.at += 1
        start = self.at
        if self.peek().isalpha():
            while self.peek().isalpha():
                self.at += 1
        else:
            self.at += 1
        return self.tex[start:self.at]

    def group_text(self):
        """Raw contents of the following {...}, for \\text."""
        if self.peek() != '{':
            raise NeedsMathType
        depth, start = 0, self.at + 1
        while self.at < len(self.tex):
            char = self.tex[self.at]
            depth += char == '{'
            depth -= char == '}'
            self.at += 1
            if depth == 0:
                return self.tex[start:self.at - 1]
        raise NeedsMathType

    def sequence(self, closing='', upright=False, italic=False, script=None):
        atoms = []
        while True:
            char = self.peek()
            if char == closing:
                if closing:
                    self.at += 1
                return atoms
            if char == '':
                raise NeedsMathType
            if char.isspace():
                self.at += 1
            elif char in '^_':
                self.at += 1
                if script or not atoms:
                    raise NeedsMathType
                base, kind = atoms[-1], 'sup' if char == '^' else 'sub'
                if base.sub or base.sup:
                    raise NeedsMathType
                content = self.script_atoms(upright, italic, kind)
                base.runs.extend(run for atom in content for run in atom.runs)
                setattr(base, kind, True)
            else:
                atoms.append(self.atom(upright, italic, script))

    def script_atoms(self, upright, italic, kind):
        if self.peek() == '{':
            self.at += 1
            atoms = self.sequence('}', upright, italic, kind)
        else:
            while self.peek().isspace():
                self.at += 1
            atoms = [self.atom(upright, italic, kind)]
        if kind == 'sup' and len(atoms) == 1 and atoms[0].runs and atoms[0].runs[0].text == '∘':
            # 30^\circ is a degree sign, written on the baseline.
            return [Atom([Run('°')], 'ord')]
        return atoms

    def atom(self, upright, italic, script):
        char = self.peek()
        letter_italic = italic or not upright
        if char == '{':
            self.at += 1
            inner = self.sequence('}', upright, italic, script)
            return Atom(spaced(inner, script), 'ord')
        if char.isalpha():
            self.at += 1
            return Atom([Run(char, letter_italic, script)], 'ord')
        if char.isdigit() or char == '.':
            start = self.at
            while self.peek().isdigit() or self.peek() == '.':
                self.at += 1
            return Atom([Run(self.tex[start:self.at], False, script)], 'ord')
        if char in '+-':
            self.at += 1
            return Atom([Run('+' if char == '+' else '−', False, script)], 'bin')
        if char in '=<>':
            self.at += 1
            return Atom([Run(char, False, script)], 'rel')
        if char in '([':
            self.at += 1
            return Atom([Run(char, False, script)], 'open')
        if char in ')]!':
            self.at += 1
            return Atom([Run(char, False, script)], 'close')
        if char in ',;:':
            self.at += 1
            return Atom([Run(char, False, script)], 'punct')
        if char in "/|*'":
            self.at += 1
            return Atom([Run('′' if char == "'" else char, False, script)], 'ord')
        if char == '\\':
            return self.control(upright, italic, script)
        raise NeedsMathType

    def control(self, upright, italic, script):
        name = self.command()
        if name in GREEK:
            return Atom([Run(GREEK[name], name[0].islower() and not upright, script)], 'ord')
        if name in ('mathrm', 'mathit'):
            if self.peek() != '{':
                raise NeedsMathType
            self.at += 1
            inner = self.sequence('}', name == 'mathrm', name == 'mathit', script)
            return Atom(spaced(inner, script), 'ord')
        if name == 'text':
            return Atom([Run(self.group_text(), False, script)], 'ord')
        if name in FUNCTIONS:
            return Atom([Run(name, False, script)], 'op')
        if name in BINARY:
            return Atom([Run(BINARY[name], False, script)], 'bin')
        if name in RELATIONS:
            return Atom([Run(RELATIONS[name], False, script)], 'rel')
        if name == 'circ':
            return Atom([Run('∘', False, script)], 'ord')
        if name in SYMBOLS and SYMBOLS[name]:
            return Atom([Run(SYMBOLS[name], False, script)], 'ord')
        if name in SPACES:
            return Atom([Run(SPACES[name], False, script)], 'space')
        raise NeedsMathType


def spaced(atoms, script):
    """TeX spacing reduced to plain spaces: around relations and binary operators, after
    top-level punctuation and between a function name and its argument. Scripts get none."""
    runs = []
    previous = None
    for atom in atoms:
        if not script and previous is not None:
            binary = atom.kind == 'bin' and previous.kind in ('ord', 'close', 'op')
            after_binary = previous.kind == 'bin' and previous.binary
            if atom.kind == 'rel' or previous.kind == 'rel' or binary or after_binary:
                runs.append(Run(' '))
            elif previous.kind == 'punct' and previous.runs[-1].text != ':':
                runs.append(Run(THIN))
            elif previous.kind == 'op' and atom.kind == 'ord':
                runs.append(Run(THIN))
        atom.binary = atom.kind == 'bin' and previous is not None and previous.kind in ('ord', 'close', 'op')
        runs.extend(atom.runs)
        previous = atom
    return runs


def merge(runs):
    merged = []
    for run in runs:
        if merged and (merged[-1].italic, merged[-1].script) == (run.italic, run.script):
            merged[-1] = Run(merged[-1].text + run.text, run.italic, run.script)
        elif run.text:
            merged.append(run)
    return merged


INLINE_MATH_STYLE = 'DR Inline Math'


def clear_east_asian_hints(path):
    """Drop w:hint="eastAsia" from runs in the inline-math character style.

    Word adds the hint when it inserts φ, ≈ or ° into a Chinese paragraph, which renders
    them in the East Asian font; COM exposes no setter for it, so the saved package is edited.
    """
    import os
    import re
    import tempfile
    import zipfile

    with zipfile.ZipFile(path) as source:
        styles = source.read('word/styles.xml').decode('utf8')
        match = re.search(r'<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>(?:(?!</w:style>).)*?<w:name w:val="'
                          + re.escape(INLINE_MATH_STYLE) + '"', styles, re.S)
        if not match:
            return 0
        marker = f'<w:rStyle w:val="{match[1]}"/>'
        cleared = 0

        def clear(run):
            nonlocal cleared
            text = run[0]
            if marker not in text or 'w:hint="eastAsia"' not in text:
                return text
            cleared += 1
            text = text.replace(' w:hint="eastAsia"', '')
            return text.replace('<w:rFonts/>', '')

        fd, temporary = tempfile.mkstemp(suffix='.docx', dir=os.path.dirname(path))
        os.close(fd)
        try:
            with zipfile.ZipFile(temporary, 'w') as target:
                for item in source.infolist():
                    data = source.read(item)
                    if item.filename.startswith('word/') and item.filename.endswith('.xml') and marker.encode() in data:
                        data = re.sub(r'<w:r(?:\s[^>]*)?>.*?</w:r>', clear, data.decode('utf8'), flags=re.S).encode('utf8')
                    target.writestr(item, data, compress_type=item.compress_type)
        except BaseException:
            os.unlink(temporary)
            raise
    os.replace(temporary, path)
    return cleared


def plain_runs(tex):
    """Formatted runs for inline TeX without layout structure, or None when MathType is needed."""
    try:
        parser = Parser(tex)
        atoms = parser.sequence()
    except NeedsMathType:
        return None
    runs = merge(spaced(atoms, None))
    return runs or None
