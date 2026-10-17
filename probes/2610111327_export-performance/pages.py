"""Create numbered six-page review sheets from every rendered PDF page."""
import argparse
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pages', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    images = sorted(args.pages.glob('page-*.png'))
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
    for start in range(0, len(images), 6):
        sheet = Image.new('RGB', (1836, 1770), '#dfe4ea')
        draw = ImageDraw.Draw(sheet)
        for offset, path in enumerate(images[start:start+6]):
            x, y = (offset % 3)*612+6, (offset//3)*885+5
            draw.text((x+6,y), f'PDF page {start+offset+1}', font=font, fill='black')
            with Image.open(path) as page:
                preview = ImageOps.contain(page.convert('RGB'), (600, 850), Image.Resampling.LANCZOS)
                sheet.paste(preview, (x,y+25))
        sheet.save(args.out/f'sheet-{start//6+1:02}.png')
    print(f'{len(images)} pages in {(len(images)+5)//6} review sheets')


if __name__ == '__main__':
    main()
