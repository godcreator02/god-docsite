"""Inline formulas written as Word text: their character style and the saved-package fix-up.

The report marks each such formula with <WordPlainMath> and supplies the runs; the engine
does not decide which TeX can become text.
"""


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
