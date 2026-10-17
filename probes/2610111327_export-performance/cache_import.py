"""Bounded equation-fragment import diagnostic, no shared Word instance."""
import json
import argparse
from pathlib import Path
from docreport.word import word_application, opened_document, find_text
from docreport.mathtype import equation_packet
from docreport.__main__ import ROOT, reserve_output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    output = reserve_output(args.out)
    results = []
    with word_application() as word:
        with opened_document(word, ROOT/'out/perf-math-cache-r01/cold.docx', True) as source:
            shape = next(s for s in source.InlineShapes if s.Type == 1)
            raw = shape.Range.WordOpenXML
        (output/'source.xml').write_text(raw, encoding='utf-8')
        for name, packet in [('minimal', equation_packet(raw)), ('original', raw)]:
            doc = word.Documents.Add()
            try:
                doc.Content.Text = 'before\t@TOKEN@\t(after)'
                target = find_text(doc, '@TOKEN@')
                target.Text = ''
                before = target.Start
                target.InsertXML(packet)
                doc.SaveAs2(str(output/(name+'.docx')), 16, AddToRecentFiles=False)
                results.append(dict(mode=name, before=before, target=[target.Start, target.End, target.Text],
                                    positions=[[s.Range.Start, s.Range.End] for s in doc.InlineShapes],
                                    text=doc.Content.Text, count=doc.InlineShapes.Count))
            except Exception as error:
                results.append(dict(mode=name, error=str(error)))
            finally:
                doc.Close(0)
    (output/'result.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(results, ensure_ascii=True))


if __name__ == '__main__':
    main()
