"""Render ten-page evidence, compare page pixels and make numbered QA sheets."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import subprocess
from PIL import Image, ImageChops, ImageDraw
from common import Path,ROOT,reserve_output,write,sha


def main():
    parser=argparse.ArgumentParser(__doc__)
    parser.add_argument('--pdf',type=Path,nargs='+',required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--pdftoppm',type=Path,default=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
    args=parser.parse_args();output=reserve_output(args.out)
    def render(item):
        index,path=item;folder=output/f'pdf-{index:02}';folder.mkdir()
        subprocess.run([str(args.pdftoppm),'-r','110','-png',str(path.resolve()),str(folder/'page')],check=True,capture_output=True)
        pages=sorted(folder.glob('page-*.png'))
        assert len(pages)==10,(path,len(pages))
        for offset in (0,6):
            sheet=Image.new('RGB',(1836,1770),'#dfe4ea');draw=ImageDraw.Draw(sheet)
            for i,p in enumerate(pages[offset:offset+6]):
                im=Image.open(p).convert('RGB');im.thumbnail((600,850))
                x=(i%3)*612;y=(i//3)*885
                draw.text((x+10,y+7),f'PDF {index} | page {offset+i+1}',fill='black')
                sheet.paste(im,(x+6,y+30))
            sheet.save(folder/f'sheet-{offset//6+1}.png')
        return dict(pdf=str(path.resolve()),pdfSha256=sha(path),pages=[str(p) for p in pages])
    with ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(render,enumerate(args.pdf)))
    for item in records[1:]:
        changed=[]
        for i,(base,other) in enumerate(zip(records[0]['pages'],item['pages']),1):
            a,b=Image.open(base).convert('RGB'),Image.open(other).convert('RGB')
            if a.size!=b.size or ImageChops.difference(a,b).getbbox():changed.append(i)
        item['pixelsDifferentFromBaselinePages']=changed
    write(output/'review-map.json',records)
    print([(i,r.get('pixelsDifferentFromBaselinePages',[])) for i,r in enumerate(records)])


if __name__=='__main__':main()
