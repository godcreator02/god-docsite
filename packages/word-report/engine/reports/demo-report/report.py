"""Optional layout and acceptance for the ten-page sample; no generation code."""
from docreport.content import bookmark, walk
from docreport.mathtype import equation_bookmark
from docreport.word import refresh, utf16_length
import re

LAYOUT = {'TblScope': {'widthsMm': [35, 65, 60]},
 'requirements': {'pageBreakBefore': True, 'orientation': 'portrait'},
 'equations': {'pageBreakBefore': True, 'orientation': 'portrait'},
 'architecture': {'pageBreakBefore': True, 'orientation': 'portrait'},
 'FigArchitecture': {'widthMm': 160},
 'results': {'pageBreakBefore': True, 'orientation': 'portrait'},
 'FigResponse': {'widthMm': 160},
 'parameters': {'pageBreakBefore': True, 'orientation': 'portrait'},
 'TblParameters': {'widthsMm': [35, 20, 38, 67]},
 'cases': {'pageBreakBefore': True, 'orientation': 'portrait'},
 'TblCases': {'widthsMm': [18, 50, 66, 26], 'minRowHeightPt': 18},
 'wide': {'pageBreakBefore': True, 'orientation': 'landscape'},
 'TblInterfaces': {'widthsMm': [24, 30, 30, 46, 36, 36, 45]},
 'conclusion': {'pageBreakBefore': True, 'orientation': 'portrait'},
 'TblRevision': {'widthsMm': [20, 32, 80, 28]},
 'p-786': {'style': 'Report Note'}}

def _numbered_blocks(content):
    return [x for x in walk(content['blocks']) if x.get('type') == 'equation' and x['numbered']]

def _numbers(doc, content):
    return [doc.Bookmarks.Item(bookmark(x['id'], '_n')).Range.Text for x in _numbered_blocks(content)]

def _fraction_references(doc):
    return [f.Result.Text for f in doc.Fields if f.Code.Text.strip().startswith('REF ' + bookmark('eq-fraction', '_n') + ' ')]

def _require_equal(name, actual, expected):
    if actual != expected:
        raise ValueError(f'Demo report {name}: expected {expected!r}, got {actual!r}')


def validate(doc, content):
    """Read this saved/reopened report's structure; never modify the document."""
    body = doc.Sections.Item(3).Range.Duplicate
    body.Collapse(1)
    ole_shapes = [shape for shape in doc.InlineShapes if shape.Type == 1]
    baseline = dict(pages=doc.ComputeStatistics(2), bodyStart=body.Information(3),
                    ommlCount=doc.OMaths.Count, tables=doc.Tables.Count,
                    figures=sum(shape.Type == 3 for shape in doc.InlineShapes),
                    mathTypeCount=sum(shape.OLEFormat.ProgID == 'Equation.DSMT4'
                                      for shape in ole_shapes),
                    embeddedObjectCount=len(ole_shapes), footnotes=doc.Footnotes.Count,
                    toc=doc.TablesOfContents.Count, contentControls=doc.ContentControls.Count,
                    orientations=[section.PageSetup.Orientation for section in doc.Sections])
    baseline['bodyPages'] = baseline['pages'] - baseline['bodyStart'] + 1
    baseline['numbers'] = _numbers(doc, content)
    baseline['fractionReferences'] = _fraction_references(doc)
    expected = dict(pages=12, bodyStart=3, bodyPages=10, ommlCount=0,
                    tables=5, figures=2, mathTypeCount=6, embeddedObjectCount=6,
                    footnotes=1, toc=1, contentControls=5,
                    orientations=[0, 0, 0, 1, 0],
                    numbers=[f'3-{index}' for index in range(1, 6)],
                    fractionReferences=['3-1', '3-1'])
    for name, value in expected.items():
        _require_equal(name, baseline[name], value)
    if re.search(r'@(MATH|FIELD|NUMSTART|NUMEND)', doc.Content.Text):
        raise ValueError('Unresolved formula or numbering placeholders remain.')
    for block in _numbered_blocks(content):
        shape = doc.Bookmarks.Item(equation_bookmark(bookmark(block['id']))).Range.InlineShapes.Item(1)
        fields = [field for field in shape.Range.Paragraphs.Item(1).Range.Fields
                  if field.Code.Text.strip().startswith(('STYLEREF ', 'SEQ Equation '))]
        if len(fields) != 2 or any(field.Locked for field in fields):
            raise ValueError(f'{block["id"]}: expected two live equation-number fields.')
    baseline['status'] = 'passed'
    return baseline


def validate_editing(doc, content):
    """Insert/delete one temporary numbered row in an unsaved, isolated reopen.

    The caller must close this document without saving even if a check fails.
    This checks field editing; it does not claim internal MathType-object editing.
    """
    first = doc.Bookmarks.Item(equation_bookmark(bookmark('eq-fraction'))).Range.Paragraphs.Item(1).Range.Start
    inserted = '\t编号验证\t(@CHECKCH@-@CHECKSEQ@)\r'
    doc.Range(first, first).InsertBefore(inserted)
    doc.Range(first, first + utf16_length(inserted)).Style = doc.Styles.Item('Equation')
    for marker, code in [('@CHECKCH@', r'STYLEREF 1 \s'),
                         ('@CHECKSEQ@', r'SEQ Equation \* ARABIC \s 1')]:
        target = doc.Content.Duplicate
        if not target.Find.Execute(FindText=marker, Wrap=0):
            raise RuntimeError(f'Numbering test marker missing: {marker}')
        doc.Fields.Add(target, -1, code, False)
    refresh(doc)
    inserted_numbers, inserted_refs = _numbers(doc, content), _fraction_references(doc)
    _require_equal('numbers after insertion', inserted_numbers, [f'3-{index}' for index in range(2, 7)])
    _require_equal('references after insertion', inserted_refs, ['3-2', '3-2'])
    # A collapsed range at a paragraph boundary can select the preceding
    # paragraph. Locate text inside the inserted row before removing it.
    temporary = doc.Content.Duplicate
    if not temporary.Find.Execute(FindText='编号验证', Wrap=0):
        raise RuntimeError('Temporary numbering row missing before deletion.')
    temporary.Paragraphs.Item(1).Range.Delete()
    refresh(doc)
    restored_numbers, restored_refs = _numbers(doc, content), _fraction_references(doc)
    _require_equal('numbers after deletion', restored_numbers, [f'3-{index}' for index in range(1, 6)])
    _require_equal('references after deletion', restored_refs, ['3-1', '3-1'])
    return dict(status='passed', saved=False,
                afterInsertion=dict(numbers=inserted_numbers, fractionReferences=inserted_refs),
                afterDeletion=dict(numbers=restored_numbers, fractionReferences=restored_refs))


def validate_pdf(texts, content):
    """Check demo-specific PDF invariants; visual review remains a separate step."""
    if not isinstance(texts, list) or not all(isinstance(text, str) for text in texts):
        raise TypeError('PDF page texts must be a list of strings.')
    _require_equal('PDF pages', len(texts), 10 + 2)
    text = '\n'.join(texts)
    # This demo has no literal backslashes. PDF extraction can separate a red
    # TeX backslash from the command, so an adjacent-command regexp misses it.
    if '\\' in text:
        raise ValueError('Demo PDF contains unparsed TeX commands; API success is insufficient.')
    compact = re.sub(r'\s+', '', text)
    numbers = [f'(3-{index})' for index in range(1, 6)]
    for number in numbers:
        if number not in compact:
            raise ValueError(f'Demo PDF equation number missing: {number}')
    return dict(status='passed', pages=len(texts), numbers=numbers,
                unparsedTex=False, visualReview='required')
