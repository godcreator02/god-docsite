"""Build the project report from the native .dotx and canonical JSON using Word."""
import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import re
import sys
import time
from PIL import Image, ImageDraw, ImageFont
from template import ROOT, TEMPLATE, append, mm
from word_com import word_application, utf16_length


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def draw_figure(block, output):
    """Deterministic figures; all numerical series come from the fixture."""
    path = output / (block['id'] + '.png')
    font_path = 'C:/Windows/Fonts/simsun.ttc'
    font = ImageFont.truetype(font_path, 32)
    small = ImageFont.truetype(font_path, 26)
    if block['kind'] == 'architecture':
        img = Image.new('RGB', (1600, 550), 'white')
        draw = ImageDraw.Draw(img)
        for i, (title, subtitle) in enumerate(zip(block['nodes'], block['subtitles'])):
            x, y = 40 + i * 400, 145
            draw.rounded_rectangle((x, y, x + 320, y + 210), 12, fill='#eef3f6', outline='#31546a', width=3)
            draw.text((x+160, y+55), title, font=font, anchor='mm', fill='#203a4c')
            lines = [subtitle] if len(subtitle) <= 9 else [subtitle[:7], subtitle[7:]]
            for j, line in enumerate(lines):
                draw.text((x+160, y+120+j*34), line, font=small, anchor='mm', fill='black')
            if i<3:
                draw.line((x+325,y+105,x+385,y+105),fill='#31546a',width=5)
                draw.polygon([(x+385,y+105),(x+371,y+96),(x+371,y+114)],fill='#31546a')
        draw.text((800,435),'配置与版本信息贯穿各模块；异常状态随接口传递',font=small,anchor='mm',fill='black')
    elif block['kind'] == 'response':
        img = Image.new('RGB',(1600,850),'white')
        draw = ImageDraw.Draw(img)
        left, top, right, bottom = 125, 100, 1510, 700
        def xy(t,y): return left+(right-left)*t/40, bottom-(bottom-top)*y
        for x in range(0,41,5):
            px,_=xy(x,0)
            draw.line((px,top,px,bottom),fill='#dddddd',width=2)
            draw.text((px,bottom+34),str(x),font=small,anchor='mm',fill='black')
        for y in [0,.2,.4,.6,.8,1.0]:
            _,py=xy(0,y)
            draw.line((left,py,right,py),fill='#dddddd',width=2)
            draw.text((left-20,py),f'{y:.1f}',font=small,anchor='rm',fill='black')
        draw.line((left,top,left,bottom,right,bottom),fill='black',width=3)
        draw.text((left,45),'归一化幅值 / p.u.',font=small,anchor='lm',fill='black')
        draw.text(((left+right)/2,800),'时间 / ms',font=font,anchor='mm',fill='black')
        samples=block['data']
        draw.line([xy(p['t'],p['y']) for p in samples], fill='#235879',width=6)
        step=[]
        for i,p in enumerate(samples):
            if i: step.append(xy(p['t'],samples[i-1]['u']))
            step.append(xy(p['t'],p['u']))
        draw.line(step,fill='#9d4f16',width=4)
        for x,label,color in [(890,'输入 u','#9d4f16'),(1180,'响应 y','#235879')]:
            draw.line((x,45,x+65,45),fill=color,width=6)
            draw.text((x+80,45),label,font=small,anchor='lm',fill='black')
    else:
        raise ValueError(f"Unknown figure kind: {block['kind']}")
    img.save(path)
    return path


def compose(doc, report, output, math_mode='omml'):
    for control in doc.ContentControls:
        if control.Tag in report['metadata']:
            control.Range.Text = report['metadata'][control.Tag]
    start = doc.Bookmarks.Item('ReportBodyStart').Range.Start
    doc.Range(start, doc.Content.End-1).Delete()
    doc.Bookmarks.Add('ReportBodyStart',doc.Range(start,start))
    equations = {e['id']:e for e in report['equations']}
    pending_math, pending_fields, pending_numbers = [], [], []

    def field_token(code, bookmark=None):
        if math_mode=='mathtype':
            code += r' \* CHARFORMAT'
        token=f'@FIELD{len(pending_fields)}@'
        pending_fields.append((token,code,bookmark))
        return token

    def paragraph(text, style=-1):
        text=re.sub(r'@REF:(\w+)@',lambda m:field_token(r'REF '+m[1]+r' \h'),text)
        return append(doc,text,style)

    def caption(kind, block):
        names={'Table':'表','Figure':'图'}
        paragraph(f"{names[kind]} {field_token('SEQ '+kind+r' \* ARABIC',block['id'])}  {block['caption']}",
                  'Table Caption' if kind=='Table' else -35)

    orientation='portrait'
    for section_index, section in enumerate(report['sections']):
        print(f"Rendering {section['id']}", flush=True)
        if section_index:
            if section['orientation'] != orientation:
                doc.Range(doc.Content.End-1,doc.Content.End-1).InsertBreak(2)
                doc.Sections.Last.PageSetup.Orientation = 1 if section['orientation']=='landscape' else 0
            else:
                doc.Range(doc.Content.End-1,doc.Content.End-1).InsertBreak(7)
        orientation=section['orientation']
        for block in section['blocks']:
            kind=block['type']
            if kind=='heading':
                paragraph(block['text'],-1-block['level'] if block['level'] else 'Appendix Heading')
            elif kind=='paragraph':
                paragraph(block['text'])
            elif kind=='list':
                list_start=doc.Content.End-1
                for item in block['items']:
                    paragraph(item,'Report Number' if block['ordered'] else 'Report Bullet')
                if block['ordered']:
                    # A style-linked list alone merges distant lists on save. Give each
                    # independent list its own native numbering definition.
                    rng=doc.Range(list_start,doc.Content.End-1)
                    rng.ListFormat.RemoveNumbers()
                    source=doc.Styles.Item('Report Number').ListTemplate.ListLevels.Item(1)
                    numbering=doc.ListTemplates.Add(False)
                    level=numbering.ListLevels.Item(1)
                    for prop in ('NumberFormat','NumberStyle','NumberPosition','TextPosition','TabPosition','TrailingCharacter'):
                        setattr(level,prop,getattr(source,prop))
                    level.StartAt=1
                    rng.ListFormat.ApplyListTemplateWithLevel(
                        ListTemplate=numbering,
                        ContinuePreviousList=False,ApplyTo=2,DefaultListBehavior=1,ApplyLevel=1)
            elif kind in ('math','inline_math'):
                token=f'@MATH{len(pending_math)}@'
                pending_math.append(dict(token=token, equation=equations[block['id']],
                                         kind=kind, boldSymbol=block.get('boldSymbol')))
                if kind=='inline_math':
                    paragraph(block['before']+token+block['after'])
                elif math_mode=='mathtype':
                    chapter=field_token(r'STYLEREF 1 \s')
                    number=field_token(r'SEQ Equation \* ARABIC \s 1')
                    a,b=f'@NUMSTART{len(pending_numbers)}@',f'@NUMEND{len(pending_numbers)}@'
                    pending_numbers.append((a,b,block['bookmark']))
                    paragraph(f'\t{token}\t({a}{chapter}-{number}{b})','Equation')
                else:
                    number=field_token(r'SEQ Equation \* ARABIC',block['bookmark'])
                    paragraph(f'\t{token}\t（{number}）','Equation')
            elif kind=='footnote':
                rng=doc.Content.Duplicate
                if not rng.Find.Execute(FindText=block['token'],Wrap=0):
                    raise RuntimeError('Footnote token missing')
                rng.Text=''
                doc.Footnotes.Add(Range=rng,Text=block['text'])
            elif kind=='table':
                caption('Table',block)
                extra=1 if block.get('groupTitle') else 0
                table=doc.Tables.Add(doc.Range(doc.Content.End-1,doc.Content.End-1),len(block['rows'])+1+extra,len(block['headers']))
                table.AllowAutoFit=False
                table.Borders.Enable=1
                table.Rows.AllowBreakAcrossPages=0
                table.Range.Style=doc.Styles.Item('Table Text')
                table.TopPadding=table.BottomPadding=3
                table.LeftPadding=table.RightPadding=4
                for i,width in enumerate(block['widthsMm'],1):
                    table.Columns.Item(i).Width=mm(width)
                for row_index,row in enumerate([block['headers']]+block['rows'],1+extra):
                    for col_index,value in enumerate(row,1):
                        table.Cell(row_index,col_index).Range.Text=str(value)
                for row_index in range(1,2+extra):
                    row=table.Rows.Item(row_index)
                    row.HeadingFormat=-1
                    row.Range.Style=doc.Styles.Item('Table Header')
                    row.Shading.BackgroundPatternColor=0xEFEFEF
                if extra:
                    table.Cell(1,1).Merge(table.Cell(1,len(block['headers'])))
                    table.Cell(1,1).Range.Text=block['groupTitle']
                if block.get('minRowHeightPt'):
                    table.Rows.HeightRule=1
                    table.Rows.Height=block['minRowHeightPt']
                table.Range.ParagraphFormat.KeepWithNext=0
                table.Rows.Item(1+extra).Range.ParagraphFormat.KeepWithNext=-1
                doc.Bookmarks.Add(block['id']+'Data',table.Range)
            elif kind=='figure':
                path=draw_figure(block,output)
                rng=paragraph('','Figure')
                picture=doc.InlineShapes.AddPicture(str(path),False,True,doc.Range(rng.Start,rng.Start))
                picture.LockAspectRatio=-1
                picture.Width=mm(block['widthMm'])
                picture.AlternativeText=block['caption']
                caption('Figure',block)
            elif kind=='hyperlink':
                rng=paragraph(block['text'],'Report Note')
                doc.Hyperlinks.Add(doc.Range(rng.Start,rng.End-1),block['url'])
            else:
                raise ValueError(f'Unknown block type: {kind}')
    for item in pending_math if math_mode=='omml' else []:
        token,linear,bold_symbol=item['token'],item['equation']['unicodeMath'],item['boldSymbol']
        rng=doc.Content.Duplicate
        if not rng.Find.Execute(FindText=token,Wrap=0): raise RuntimeError(token)
        start=rng.Start
        rng.Text=linear
        math=doc.OMaths.Add(doc.Range(start,start+utf16_length(linear))).OMaths.Item(1)
        math.BuildUp()
        if bold_symbol:
            symbol=math.Range.Duplicate
            if not symbol.Find.Execute(FindText=bold_symbol,Wrap=0): raise RuntimeError('Matrix symbol missing')
            symbol.Font.Bold,symbol.Font.Italic=-1,0
    for token,code,bookmark in pending_fields:
        rng=doc.Content.Duplicate
        if not rng.Find.Execute(FindText=token,Wrap=0): raise RuntimeError(token)
        field=doc.Fields.Add(rng,-1,code,math_mode!='mathtype')
        if math_mode=='mathtype':
            field.Code.Font.Bold,field.Code.Font.Italic=0,0
        if bookmark: doc.Bookmarks.Add(bookmark,field.Result)
    for begin,end,bookmark in pending_numbers:
        rng=doc.Content.Duplicate
        if not rng.Find.Execute(FindText=end,Wrap=0): raise RuntimeError(end)
        end_position=rng.Start
        rng.Delete()
        rng=doc.Content.Duplicate
        if not rng.Find.Execute(FindText=begin,Wrap=0): raise RuntimeError(begin)
        start_position=rng.Start
        rng.Delete()
        doc.Bookmarks.Add(bookmark,doc.Range(start_position,end_position-len(begin)))
    for table in doc.Tables:
        following=doc.Range(table.Range.End,table.Range.End).Paragraphs.First.Format
        following.SpaceBefore=max(6,following.SpaceBefore)
    for i,section in enumerate(doc.Sections,1):
        if i>1:
            section.Headers.Item(1).Range.Text=report['shortTitle']
        if i>3:
            footer=section.Footers.Item(1)
            footer.PageNumbers.RestartNumberingAtSection=False
            footer.PageNumbers.NumberStyle=0
    doc.Fields.Update()
    doc.Fields.Update()
    for toc in doc.TablesOfContents: toc.Update()
    doc.Repaginate()
    for toc in doc.TablesOfContents: toc.UpdatePageNumbers()
    return pending_math


def build(output, math_mode='omml'):
    output=output.resolve()
    if not output.is_relative_to(ROOT/'out'):
        raise ValueError('Use a fresh directory under the repository out/.')
    output.mkdir(parents=True,exist_ok=True)
    destination=output/('mathtype-draft.docx' if math_mode=='mathtype' else 'word-com.raw.docx')
    if destination.exists(): raise FileExistsError(f'Use a fresh directory under out/: {destination}')
    fixture_path=ROOT/'fixtures/canonical.json'
    report=json.loads(fixture_path.read_text(encoding='utf-8'))['projectReport']
    template_hash=sha(TEMPLATE)
    started=time.perf_counter()
    with word_application() as word:
        startup=time.perf_counter()-started
        doc=word.Documents.Add(Template=str(TEMPLATE),NewTemplate=False)
        doc.UpdateStylesOnOpen=False
        pending_math=compose(doc,report,output,math_mode)
        doc.SaveAs2(str(destination),16,AddToRecentFiles=False)
        record=dict(profile=report['profile'],source='fixtures/canonical.json#projectReport',sourceSha256=sha(fixture_path),
                    template=report['template'],templateSha256=template_hash,templateUnchanged=sha(TEMPLATE)==template_hash,
                    wordVersion=word.Version,wordBuild=word.Build,startupSeconds=startup,
                    generationSeconds=time.perf_counter()-started-startup,mathCount=doc.OMaths.Count,
                    mathInput='LaTeX placeholders for MathType' if math_mode=='mathtype' else 'Word native UnicodeMath BuildUp',controller='Python + pywin32',
                    pywin32Version=importlib.metadata.version('pywin32'),pythonExecutable=sys.executable)
        (output/'word-com-generation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    if math_mode=='mathtype':
        spec=importlib.util.spec_from_file_location('mathtype_probe',Path(__file__).with_name('mathtype-probe.py'))
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        destination=module.render_report(destination,pending_math,report)
    print(destination)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output_directory',type=Path)
    parser.add_argument('--mathtype',action='store_true',help='Render all inline and display formulas as editable MathType OLE')
    args=parser.parse_args()
    build(args.output_directory,'mathtype' if args.mathtype else 'omml')
