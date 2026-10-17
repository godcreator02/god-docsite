"""Real saved-report regression: same image bytes, different Word display size."""
import argparse
from pathlib import Path
from hashlib import sha256
from details import inventory


def main():
    parser=argparse.ArgumentParser(__doc__)
    parser.add_argument('--baseline',type=Path,default=Path('out/locked-review-r01/baseline.docx'))
    parser.add_argument('--returned',type=Path,default=Path('out/locked-readback-r02/returned.docx'))
    args=parser.parse_args()
    assert sha256(args.baseline.read_bytes()).hexdigest()=='cbf3a05e3c2402115ab1831aedb953bfb072e5c95fbda970168522544c544305'
    assert sha256(args.returned.read_bytes()).hexdigest()=='15c6c84ad72dabe7cd0adb7e51b2ff956f6a12988809d0a4255ef4f26e096758'
    old=inventory(args.baseline,{})['drawings'];new=inventory(args.returned,{})['drawings']
    assert len(old)==len(new)==1
    old,new=old[0],new[0]
    assert old['sha256']==new['sha256'],'Fixture should preserve image bytes'
    assert 'layout' in old and 'layout' in new,'BUG: reader records image bytes but omits display geometry'
    assert old['layout']['extentEmu']=={'cx':3240000,'cy':1113929}
    assert new['layout']['extentEmu']=={'cx':3835291,'cy':2042931}
    assert old['layout']!=new['layout'],'BUG: resizing must be reported despite unchanged image bytes'
    from details import compare_drawings
    changes=compare_drawings([old],[new])
    assert len(changes)==1 and changes[0]['layoutChanged'] and not changes[0]['imageBytesChanged']
    assert changes[0]['sizeChanged'] and changes[0]['aspectRatioChanged']
    assert compare_drawings([old],[old])==[],'Unchanged layout must not be a change'
    print('PASS: same image bytes + resized display detected; unchanged image has no change')


if __name__=='__main__':main()
