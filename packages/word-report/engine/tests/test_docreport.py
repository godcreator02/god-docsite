r"""Run with .venv\Scripts\python.exe -m unittest discover -s tests -v.

These tests do not start Word. The demo build separately exercises the real COM
and MathType pipeline, saved-object checks and report-specific numbering edits.
"""
import json
import copy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from zipfile import ZipFile

from docreport.__main__ import load_report, reserve_output
from docreport.compose import Composer, ContentComposer
from docreport.mathtype import mathtype_tex, readback_tex_matches, validate_pending
from docreport.verify import package_state
from docreport.word import utf16_length, word_application
from docreport.content import read_json, validate_content, validate_layout, table_grid, bookmark, walk


class ContentProtocolTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).resolve().parents[1]
        self.content = {'format': 'docreport', 'schemaVersion': 1, 'id': 'report',
                        'metadata': {'title': '独立报告', 'language': 'zh-CN'},
                        'blocks': [{'type': 'paragraph', 'id': 'p',
                                    'content': [{'type': 'text', 'text': '无需专属 Python。😀'}]}]}

    def test_plain_report_loads_without_report_python(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory / 'content.json').write_text(json.dumps(self.content), encoding='utf-8')
            _, data, module, template = load_report(directory)
            self.assertEqual(data, self.content)
            self.assertTrue(callable(module.build))
            self.assertTrue(template.is_file())

    def test_layout_rejects_unknown_ids_keys_and_incorrect_value_types(self):
        for layout in ({'missing': {'style':'Normal'}}, {'p': {'widthMm':10}}, {'p': {'style':12}}):
            with self.subTest(layout=layout), self.assertRaises(ValueError):
                validate_layout(layout, self.content)
        validate_layout({'p':{'style':'Normal'}}, self.content)

    def test_abstract_is_first_class_and_plain_reports_remain_valid(self):
        data = copy.deepcopy(self.content)
        paragraph = data['blocks'].pop()
        data['blocks'] = [dict(type='abstract', id='abstract', paragraphs=[paragraph],
                               keywords=['控制器', '验证'])]
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory/'content.json').write_text(json.dumps(data), encoding='utf-8')
            _, loaded, _, _ = load_report(directory)
            self.assertEqual(loaded['blocks'][0]['type'], 'abstract')
        validate_content(self.content, self.root)

    def test_abstract_rejects_nonprose_nested_late_duplicate_and_padded_keywords(self):
        abstract = dict(type='abstract', id='abstract',
                        paragraphs=copy.deepcopy(self.content['blocks']), keywords=['控制器'])
        table = dict(type='table', id='table', numbered=False, columns=[dict(id='column')],
                     headerRows=0, rows=[dict(id='row', cells=[dict(id='cell', blocks=[])])])
        chapter = dict(type='section', id='chapter', title='正文', numbering='decimal',
                       children=[dict(type='paragraph', id='body', content=[])])
        cases = []
        for wrong in (table, dict(type='code', id='code', language='text', text='x')):
            changed = copy.deepcopy(abstract)
            changed['paragraphs'] = [wrong]
            cases.append([changed])
        for keywords in ([' 关键词'], ['关键词　'], ['　'], [], ['重复', '重复']):
            changed = copy.deepcopy(abstract); changed['keywords'] = keywords
            cases.append([changed])
        nested = copy.deepcopy(chapter); nested['children'] = [abstract]
        duplicate = copy.deepcopy(abstract)
        duplicate['id'] = 'second'; duplicate['paragraphs'][0]['id'] = 'second-p'
        empty = copy.deepcopy(abstract); empty['paragraphs'][0]['content'] = []
        cases += [[nested], [chapter, abstract], [abstract, duplicate], [empty]]
        for blocks in cases:
            data = copy.deepcopy(self.content); data['blocks'] = blocks
            with self.subTest(blocks=blocks), self.assertRaises(ValueError):
                validate_content(data, self.root)
        data['blocks'] = [abstract]
        with self.assertRaisesRegex(ValueError, 'dedicated abstract styles'):
            validate_layout({'p': {'style': 'Normal'}}, data)

    def test_citations_in_notes_follow_note_reference_reading_order(self):
        data=copy.deepcopy(self.content)
        data['blocks'][0]['content']=[dict(type='note_ref',id='nref',target='note'),dict(type='cite',id='cite-body',targets=['source-b'])]
        data['notes']=[dict(id='note',blocks=[dict(type='paragraph',id='np',content=[dict(type='cite',id='cite-note',targets=['source-a'])])])]
        data['references']=[dict(id='source-b',text='B'),dict(id='source-a',text='A')]
        data['blocks'].append(dict(type='bibliography',id='bib'))
        self.assertEqual(validate_content(data,self.root)['citations'],['source-a','source-b'])

    def test_duplicate_json_keys_and_nonfinite_numbers_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'input.json'
            for text in ('{"id":"a","id":"b"}', '{"n": NaN}', '{"n": Infinity}'):
                path.write_text(text, encoding='utf-8')
                with self.assertRaises(ValueError):
                    read_json(path)

    def test_reject_unknown_version_field_and_duplicate_id(self):
        for mutation in (lambda d: d.update(schemaVersion=2),
                         lambda d: d.update(unrecognized=True),
                         lambda d: d['blocks'].append(copy.deepcopy(d['blocks'][0]))):
            with self.subTest(mutation=mutation):
                data = copy.deepcopy(self.content)
                mutation(data)
                with self.assertRaises(ValueError):
                    validate_content(data, self.root)

    def test_id_mapping_preserves_case_and_punctuation_distinctions(self):
        ids = ['eq-a', 'eq_a', 'EQ-a', 'x' * 64]
        names = [bookmark(x, '_n') for x in ids]
        self.assertEqual(len({x.casefold() for x in names}), len(ids))
        self.assertTrue(all(len(x) <= 40 for x in names))

    def test_nested_merged_grid_and_invalid_cross_header_span(self):
        cell = lambda ident, **kw: dict(id=ident, blocks=[], **kw)
        table = dict(type='table', id='t', numbered=False,
                     columns=[{'id':'c1'}, {'id':'c2'}], headerRows=1,
                     rows=[dict(id='r1', cells=[cell('head', colSpan=2)]),
                           dict(id='r2', cells=[cell('v', rowSpan=2), cell('b')]),
                           dict(id='r3', cells=[cell('c')])])
        self.assertEqual([(r,c,rs,cs) for r,c,rs,cs,_ in table_grid(table)],
                         [(0,0,1,2),(1,0,2,1),(1,1,1,1),(2,1,1,1)])
        data = copy.deepcopy(self.content)
        data['blocks'].append(table)
        validate_content(data, self.root)
        table['rows'][0]['cells'][0]['rowSpan'] = 2
        with self.assertRaisesRegex(ValueError, 'header boundary'):
            table_grid(table)

    def test_full_schema_example_contains_three_table_levels(self):
        data = read_json(self.root / 'schemas/report-content.example.json')
        ctx = validate_content(data, self.root / 'reports/demo-report')
        self.assertIn('tbl-ranges', ctx['index'])
        table = ctx['index']['tbl-nested-demo']
        self.assertEqual(sum(x.get('type') == 'table' for x in walk(table)), 3)

    def test_nested_equation_requires_chapter_and_ref_requires_number(self):
        data = read_json(self.root / 'schemas/report-content.example.json')
        lookup = {x['id']: x for x in walk(data) if 'id' in x}
        data['blocks'] = [lookup['tbl-nested-demo']]
        data.pop('notes', None)
        data.pop('references', None)
        with self.assertRaisesRegex(ValueError, 'outside a chapter'):
            validate_content(data, self.root / 'reports/demo-report')
        data = copy.deepcopy(self.content)
        data['blocks'][0]['content'].append(dict(type='ref',id='r',target='missing',display='label'))
        with self.assertRaisesRegex(ValueError, 'reference target'):
            validate_content(data, self.root)

    def test_missing_and_escaped_images_fail_before_word(self):
        data = read_json(self.root / 'reports/demo-report/content.json')
        image = next(x for x in walk(data) if x.get('type') == 'figure')
        for path in ('assets/missing.png', 'assets/../outside.png', 'assets/CON.png'):
            image['src'] = path
            with self.subTest(path=path), self.assertRaises(ValueError):
                validate_content(data, self.root / 'reports/demo-report')

    def test_img_extension_must_match_actual_encoding(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/'assets').mkdir()
            Image.new('RGB',(2,2)).save(root/'assets/wrong.png', format='JPEG')
            data=copy.deepcopy(self.content)
            figure = dict(type='figure',id='fig',src='assets/wrong.png',alt='图',caption=[dict(type='text',text='图')])
            data['blocks'].append(dict(type='section',id='chapter',title='结果',numbering='decimal',children=[figure]))
            with self.assertRaisesRegex(ValueError, 'encoding'):
                validate_content(data, root)

    def test_figures_and_numbered_tables_require_a_numbered_chapter(self):
        figure = dict(type='figure', id='fig', src='assets/missing.png', alt='图', caption=[dict(type='text', text='图')])
        table = dict(type='table', id='tbl', numbered=True, caption=[dict(type='text', text='表')], columns=[dict(id='c')],
                     headerRows=0, rows=[dict(id='r', cells=[dict(id='x', blocks=[])])])
        for block, message in ((figure, 'numbered figure outside a chapter'), (table, 'numbered table outside a chapter')):
            front = dict(type='section', id='front', title='前言', numbering='none', children=[copy.deepcopy(block)])
            for blocks in ([copy.deepcopy(block)], [front]):
                data = copy.deepcopy(self.content); data['blocks'] = blocks
                with self.subTest(blocks=blocks), self.assertRaisesRegex(ValueError, message):
                    validate_content(data, self.root)
        data = copy.deepcopy(self.content)
        data['blocks'].append(dict(table, numbered=False))
        validate_content(data, self.root)


class ChapterNumberFieldTests(unittest.TestCase):
    def composer(self, appendix_count=0):
        composer = ContentComposer.__new__(ContentComposer)
        Composer.__init__(composer, MagicMock())
        composer.chapter_is_appendix, composer.appendix_count = appendix_count > 0, appendix_count
        return composer

    def test_figure_and_table_numbers_use_chapter_and_restarting_sequence_like_equations(self):
        for kind in ('Figure', 'Table', 'Equation'):
            composer = self.composer()
            with self.subTest(kind=kind):
                self.assertEqual(composer.chapter_sequence(kind, 'bm'), '@NUMSTART0@@FIELD0@-@FIELD1@@NUMEND0@')
                self.assertEqual([code for _, code, _ in composer._pending_fields],
                                 [r'STYLEREF 1 \s \* CHARFORMAT', 'SEQ ' + kind + r' \* ARABIC \s 1 \* CHARFORMAT'])
                self.assertEqual([mark for *_, mark in composer._pending_fields], [None, None])
                self.assertEqual(composer._pending_numbers, [('@NUMSTART0@', '@NUMEND0@', 'bm')])

    def test_appendix_numbers_use_appendix_heading_and_a_sequence_per_appendix(self):
        composer = self.composer(appendix_count=2)
        composer.chapter_sequence('Table', 'bm')
        self.assertEqual([code for _, code, _ in composer._pending_fields],
                         [r'STYLEREF "Appendix Heading" \s \* CHARFORMAT', r'SEQ TableAppendixB \* ARABIC \* CHARFORMAT'])


class ReportBoundaryTests(unittest.TestCase):
    def test_output_is_fresh_and_cannot_escape_out(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for target in (root / 'out', root / 'report', root / 'out/../report'):
                with self.assertRaises(ValueError):
                    reserve_output(target, root)
            path = reserve_output(root / 'out/first', root)
            marker = path / 'keep.txt'
            marker.write_text('original', encoding='utf-8')
            with self.assertRaises(FileExistsError):
                reserve_output(path, root)
            self.assertEqual(marker.read_text(encoding='utf-8'), 'original')

    def test_report_contract_accepts_independent_content_and_checks_template(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'layout.dotx').write_bytes(b'template is opened by Word later')
            payload = {'template': 'layout.dotx', 'uniqueReportProperty': [1, 2]}
            (root / 'content.json').write_text(json.dumps(payload), encoding='utf-8')
            (root / 'report.py').write_text('def build(doc, content, output): return []\ndef validate(doc, content): return {}\n', encoding='utf-8')
            directory, content, module, template = load_report(root)
            self.assertEqual(content, payload)
            self.assertEqual(template, (root / 'layout.dotx').resolve())
            self.assertEqual(module.build(None, content, None), [])
            payload['template'] = 'missing.dotx'
            (root / 'content.json').write_text(json.dumps(payload), encoding='utf-8')
            with self.assertRaises(ValueError):
                load_report(root)

    def test_word_session_cleans_only_its_owned_instance_on_failure(self):
        owned = MagicMock()
        owned.Documents.Count = 2
        with patch('win32com.client.DispatchEx', return_value=owned) as create:
            with self.assertRaisesRegex(RuntimeError, 'builder failed'):
                with word_application() as word:
                    self.assertIs(word, owned)
                    raise RuntimeError('builder failed')
        create.assert_called_once_with('Word.Application')
        self.assertEqual([call.args[0] for call in owned.Documents.Item.call_args_list], [2, 1])
        owned.Quit.assert_called_once_with(SaveChanges=0)

    def test_utf16_offsets_include_surrogate_pairs(self):
        self.assertEqual(utf16_length('公式😀x'), 5)


class MathTypeTests(unittest.TestCase):
    def test_readback_delimiters_do_not_change_the_exact_equation_body(self):
        tex = r'i_L(t) = I_0 + \Delta i\sin(\omega t)'
        for opening, closing in ((r'\[', r'\]'), (r'\(', r'\)'), ('$$', '$$'), ('$', '$'), ('', '')):
            self.assertTrue(readback_tex_matches(opening + tex + closing, tex))
        for wrong in (r'\[x\]', r'\[' + tex + r'\)', '$' + tex + '$$', '$$' + tex + '$', '$' + tex + '$ $x$', tex + 'x'):
            self.assertFalse(readback_tex_matches(wrong, tex))

    def test_aligned_adapter_preserves_rows_and_rejects_unverified_columns(self):
        self.assertEqual(mathtype_tex(r'\begin{aligned}a&=b\\c&=d\end{aligned}'),
                         r'\begin{array}{rl}a&=b\\c&=d\end{array}')
        self.assertEqual(mathtype_tex(r'\frac{a}{b}'), r'\frac{a}{b}')
        with self.assertRaises(ValueError):
            mathtype_tex(r'\begin{aligned}a&=b&c\end{aligned}')
        with self.assertRaises(ValueError):
            mathtype_tex('中文')

    def test_pending_rejects_ids_that_collide_after_word_bookmark_normalization(self):
        pending = [{'token': '@MATH0@', 'kind': 'math', 'equation': {'id': 'eq-a', 'latex': 'a'}},
                   {'token': '@MATH1@', 'kind': 'inline_math', 'equation': {'id': 'eq_a', 'latex': 'a'}}]
        with self.assertRaisesRegex(ValueError, 'distinct bookmark'):
            validate_pending(pending)
        pending[1]['equation']['id'] = 'second'
        validate_pending(pending)
        pending[1]['token'] = '@MATH0@'
        with self.assertRaisesRegex(ValueError, 'unique'):
            validate_pending(pending)

    def test_saved_package_requires_actual_embedded_payload(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'test.docx'

            def make(ole_type='Embed', payload=True, omml=False):
                xml = ('<doc xmlns:o="urn:schemas-microsoft-com:office:office" '
                       'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
                       'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">'
                       f'<o:OLEObject ProgID="Equation.DSMT4" Type="{ole_type}" r:id="rId1"/>'
                       + ('<m:oMath/>' if omml else '') + '</doc>')
                with ZipFile(path, 'w') as archive:
                    archive.writestr('word/document.xml', xml)
                    archive.writestr('word/_rels/document.xml.rels',
                                     '<Relationships><Relationship Id="rId1" Target="embeddings/eq.bin"/></Relationships>')
                    if payload:
                        archive.writestr('word/embeddings/eq.bin', b'payload')

            make()
            self.assertEqual(package_state(path, 1)['mathTypeObjects'], 1)
            for kwargs in ({'ole_type': 'Link'}, {'payload': False}, {'omml': True}):
                make(**kwargs)
                with self.assertRaises(RuntimeError):
                    package_state(path, 1)


if __name__ == '__main__':
    unittest.main()
