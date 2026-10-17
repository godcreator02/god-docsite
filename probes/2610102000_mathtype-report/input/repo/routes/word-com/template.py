"""Create the reusable native Word template; ordinary builds never rewrite it."""
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from word_com import word_application, utf16_length

TEMPLATE = ROOT / 'templates/project-report.dotx'


def mm(value):
    return value * 72 / 25.4


def append(doc, text, style=-1):
    start = doc.Content.End - 1
    doc.Range(start, start).InsertAfter(text + '\r')
    rng = doc.Range(start, start + utf16_length(text) + 1)
    rng.Style = doc.Styles.Item(style)
    return rng


def create_template(replace=False):
    if TEMPLATE.exists() and not replace:
        raise FileExistsError('Template exists. Edit it in Word, or pass --replace to regenerate deliberately.')
    with word_application() as word:
        doc = word.Documents.Add()
        doc.UpdateStylesOnOpen = False
        setup = doc.PageSetup
        setup.PageWidth, setup.PageHeight = mm(210), mm(297)
        setup.TopMargin = setup.BottomMargin = setup.LeftMargin = setup.RightMargin = mm(25)
        setup.HeaderDistance = setup.FooterDistance = mm(12.5)
        setup.DifferentFirstPageHeaderFooter = 0

        def style(key, size=12, font='宋体', bold=False, align=0, indent=0,
                  before=0, after=0, single=False, keep=False):
            if isinstance(key, str):
                try: st = doc.Styles.Item(key)
                except Exception: st = doc.Styles.Add(key, 1)
            else: st = doc.Styles.Item(key)
            st.Font.Name = 'Times New Roman'
            st.Font.NameFarEast = font
            st.Font.Size, st.Font.Bold, st.Font.Italic, st.Font.Color = size, -int(bold), 0, 0
            p = st.ParagraphFormat
            p.Alignment, p.FirstLineIndent = align, indent
            p.LeftIndent = p.RightIndent = 0
            p.SpaceBefore, p.SpaceAfter = before, after
            p.LineSpacingRule = 0 if single else 1
            p.WidowControl, p.KeepWithNext, p.KeepTogether = -1, -int(keep), 0
            p.PageBreakBefore = 0
            st.AutomaticallyUpdate = False
            return st

        style(-1, indent=24, after=6)
        for level, size in [(1,16),(2,14),(3,12)]:
            st = style(-1-level, size, '黑体', before=10 if level==1 else 6, after=6, keep=True)
            st.NextParagraphStyle = doc.Styles.Item(-1)
        style(-63, 28, '黑体', align=1, before=100, after=28)
        style('Cover Project', 18, '黑体', align=1, after=60)
        style('Cover Meta', 12, align=1, after=12)
        style('TOC Title', 18, '黑体', align=1, after=16)
        for depth,key in enumerate([-20,-21,-22]):
            style(key, 10.5, single=True, after=5).ParagraphFormat.LeftIndent=depth*14
        style(-32, 9, align=2, single=True)
        style(-33, 9, align=1, single=True)
        style(-35, 10.5, align=1, before=6, after=6, single=True)
        style('Table Caption', 10.5, align=1, before=6, after=6, single=True, keep=True)
        style('Table Text', 10.5, after=0, single=True)
        style('Table Header', 10.5, bold=True, align=1, single=True)
        style('Figure', align=1, before=6, after=0, single=True, keep=True)
        style('Equation', before=6, after=6)
        eq = doc.Styles.Item('Equation').ParagraphFormat
        eq.KeepTogether = -1
        eq.TabStops.ClearAll()
        eq.TabStops.Add(mm(80), 1, 0)
        eq.TabStops.Add(mm(160), 2, 0)
        style('Report Note', 10.5, after=6, single=True)
        style('Appendix Heading', 14, '黑体', before=10, after=6, keep=True)
        style('Report Bullet', after=4)
        style('Report Number', after=4)
        style(-30, 9, single=True)  # Footnote Text
        headings = doc.ListTemplates.Add(True, 'ReportHeadings')
        for level in range(1,4):
            item = headings.ListLevels.Item(level)
            item.NumberFormat = '.'.join('%'+str(n) for n in range(1,level+1))
            item.NumberStyle, item.StartAt, item.ResetOnHigher = 0, 1, level-1
            item.NumberPosition, item.TextPosition, item.TrailingCharacter = 0, 0, 1
            item.LinkedStyle = doc.Styles.Item(-1-level).NameLocal
            doc.Styles.Item(-1-level).LinkToListTemplate(headings, level)
        for name, fmt, kind in [('ReportBullets','•',23),('ReportNumbers','%1.',0)]:
            lt = doc.ListTemplates.Add(False,name)
            item = lt.ListLevels.Item(1)
            item.NumberFormat, item.NumberStyle = fmt, kind
            item.NumberPosition, item.TextPosition, item.TabPosition = 0, 18, 18
            item.TrailingCharacter = 0
            target = 'Report Bullet' if kind==23 else 'Report Number'
            item.LinkedStyle = target
            doc.Styles.Item(target).LinkToListTemplate(lt,1)

        for tag, placeholder, sty in [
            ('reportTitle','项目技术报告','Title'),
            ('projectName','项目名称','Cover Project'),
            ('author','编制单位','Cover Meta'),
            ('revision','版本编号','Cover Meta'),
            ('date','编制日期','Cover Meta')]:
            rng = append(doc, placeholder, -63 if sty=='Title' else sty)
            cc = doc.ContentControls.Add(0,doc.Range(rng.Start,rng.End-1))
            cc.Tag, cc.Title = tag, placeholder
        doc.Range(doc.Content.End-1,doc.Content.End-1).InsertBreak(2)
        append(doc,'目录','TOC Title')
        rng = append(doc,'目录将在更新域后生成','Report Note')
        doc.Fields.Add(doc.Range(rng.Start,rng.End-1),-1,r'TOC \o "1-3" \h \z \u',True)
        doc.Range(doc.Content.End-1,doc.Content.End-1).InsertBreak(2)
        rng = append(doc,'正文标题',-2)
        doc.Bookmarks.Add('ReportBodyStart',doc.Range(rng.Start,rng.Start))
        append(doc,'在此编写项目正文。使用标题样式建立章节，使用题注和交叉引用维护编号。')
        for i,section in enumerate(doc.Sections,1):
            header,footer = section.Headers.Item(1),section.Footers.Item(1)
            header.LinkToPrevious = footer.LinkToPrevious = False
            header.Range.Text = '' if i==1 else '项目技术报告'
            footer.Range.Text = ''
            if i>1:
                footer.Range.ParagraphFormat.Alignment=1
                doc.Fields.Add(footer.Range,33)
                footer.PageNumbers.RestartNumberingAtSection=True
                footer.PageNumbers.StartingNumber=1
                footer.PageNumbers.NumberStyle=1 if i==2 else 0
        doc.SaveAs2(str(TEMPLATE),14,AddToRecentFiles=False)
    print(TEMPLATE)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--replace',action='store_true')
    create_template(parser.parse_args().replace)
