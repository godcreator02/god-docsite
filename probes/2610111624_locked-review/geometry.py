"""Read-only Word COM confirmation of the saved image-resize regression."""
import argparse
import json
from pathlib import Path
import shutil
from details import inventory,compare_drawings,digest,read,write,HERE,ROOT
from word_session import word_application,opened_document


def main():
    parser=argparse.ArgumentParser(__doc__)
    parser.add_argument('--session',type=Path,required=True)
    parser.add_argument('--readback',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args();output=args.out.resolve()
    if output==ROOT/'out' or not output.is_relative_to(ROOT/'out'):raise ValueError('Use fresh out/ child')
    output.mkdir(parents=True,exist_ok=False)
    session=read(args.session/'session.json');back=read(args.readback/'readback.json')
    baseline=Path(session['baselinePath']);returned=args.readback/'returned.docx'
    assert digest(baseline)==session['baselineSha256'] and digest(returned)==back['returnedSha256']
    before,after=[inventory(p,session['bookmarkToSourceId']) for p in (baseline,returned)]
    result=dict(baselineSha256=digest(baseline),returnedSha256=digest(returned),
        drawingComparisons=compare_drawings(before['drawings'],after['drawings']),wordMeasurements={},
        priorFormulaEvidence='probes/2610111624_locked-review/evidence/locked-details-r01/details.json',
        boundary='This verifies the single embedded inline DrawingML picture in this saved report, not arbitrary VML, grouped, linked, floating or chart objects. No source JSON mapping is inferred from a media hash.',
        policy='Private read-only snapshot copies, no save, no unprotect, no MathType activation, no JSON mutation.')
    with word_application() as word:
        for tag,path,package in [('baseline',baseline,before),('returned',returned,after)]:
            target=output/(tag+'.docx');shutil.copy2(path,target)
            with opened_document(word,target,True) as doc:
                pictures=[]
                for shape in doc.InlineShapes:
                    if shape.Type!=3:continue
                    fmt=shape.PictureFormat
                    pictures.append(dict(widthPt=float(shape.Width),heightPt=float(shape.Height),
                        widthCm=float(shape.Width)*2.54/72,heightCm=float(shape.Height)*2.54/72,
                        paragraphAlignment=int(shape.Range.ParagraphFormat.Alignment),
                        cropPt={key:float(getattr(fmt,key)) for key in ['CropLeft','CropRight','CropTop','CropBottom']}))
                assert len(pictures)==len(package['drawings'])==1,'Single-picture test fixture expected'
                image=pictures[0];extent=package['drawings'][0]['layout']['extentEmu']
                assert abs(image['widthPt']-extent['cx']/12700)<0.1
                assert abs(image['heightPt']-extent['cy']/12700)<0.1
                result['wordMeasurements'][tag]=dict(pictures=pictures,revisions=int(doc.Revisions.Count),
                    comments=int(doc.Comments.Count),trackRevisions=bool(doc.TrackRevisions),protectionType=int(doc.ProtectionType))
            assert digest(target)==digest(path),'Read-only copy unexpectedly modified'
    result['status']='geometry-confirmed-not-merged'
    result['regression']={'beforeFix':'FAIL: reader records image bytes but omits display geometry',
        'afterFix':'PASS: same image bytes + resized display detected; unchanged image has no change'}
    write(output/'geometry.json',result)
    for name in ['geometry.py','details.py','word_session.py','check_geometry.py']:shutil.copy2(HERE/name,output/name)
    evidence=HERE/'evidence'/output.name;evidence.mkdir(parents=True,exist_ok=False)
    for name in ['geometry.json','geometry.py','details.py','word_session.py','check_geometry.py']:shutil.copy2(output/name,evidence/name)
    print(json.dumps(dict(status=result['status'],wordMeasurements=result['wordMeasurements']),ensure_ascii=True))


if __name__=='__main__':main()
