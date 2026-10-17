param([Parameter(Mandatory)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
$labRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$f=Get-Content -LiteralPath (Join-Path $labRoot 'fixtures/canonical.json') -Raw | ConvertFrom-Json
$timer=[Diagnostics.Stopwatch]::StartNew()
$word=$null; $doc=$null
function Add-Text([string]$Text,[object]$Style=-1) {
    $start=$doc.Content.End-1
    $r=$doc.Range($start,$start); $r.InsertAfter($Text+"`r")
    $r=$doc.Range($start,$start+$Text.Length+1)
    if("$Style" -match '^-?\d+$'){$r.Style=$doc.Styles.Item([int]$Style)}else{$r.Style=$doc.Styles.Item([string]$Style)}
    return $r
}
function Add-Break { $r=$doc.Range($doc.Content.End-1,$doc.Content.End-1);$r.InsertBreak(7) }
function Set-Style([object]$Id,[double]$Size,[bool]$Bold=$false,[int]$Alignment=0) {
    $st=if("$Id" -match '^-?\d+$'){$doc.Styles.Item([int]$Id)}else{$doc.Styles.Item([string]$Id)}
    $st.Font.Name='Times New Roman';$st.Font.NameFarEast='仿宋';$st.Font.Size=$Size;$st.Font.Bold=[int]$Bold;$st.Font.Italic=0;$st.Font.Color=0
    $pf=$st.ParagraphFormat;$pf.Alignment=$Alignment;$pf.FirstLineIndent=0;$pf.SpaceBefore=0;$pf.SpaceAfter=0;$pf.LineSpacingRule=1;$pf.WidowControl=-1
    return $st
}
function Replace-Field([string]$Token,[string]$Code,[string]$Bookmark='') {
    $r=$doc.Content.Duplicate
    if(-not $r.Find.Execute($Token)) {throw "Field token not found: $Token"}
    $field=$doc.Fields.Add($r,-1,$Code,$true)
    if($Bookmark){$null=$doc.Bookmarks.Add($Bookmark,$field.Result)}
}
try {
    $word=New-Object -ComObject Word.Application
    $word.Visible=$false;$word.DisplayAlerts=0;$word.AutomationSecurity=3
    $startup=$timer.Elapsed.TotalSeconds
    $doc=$word.Documents.Add()
    $ps=$doc.PageSetup;$ps.PageWidth=$word.MillimetersToPoints(210);$ps.PageHeight=$word.MillimetersToPoints(297)
    $ps.TopMargin=$ps.BottomMargin=$word.MillimetersToPoints(25.4);$ps.LeftMargin=$word.MillimetersToPoints(23);$ps.RightMargin=$word.MillimetersToPoints(22)
    $ps.HeaderDistance=$ps.FooterDistance=$word.MillimetersToPoints(12.7);$ps.DifferentFirstPageHeaderFooter=-1
    $st=Set-Style -1 12;$st.ParagraphFormat.FirstLineIndent=24
    $st=Set-Style -2 15 $true;$st.ParagraphFormat.SpaceBefore=12;$st.ParagraphFormat.SpaceAfter=6;$st.ParagraphFormat.KeepWithNext=-1
    $st=Set-Style -3 12 $true;$st.ParagraphFormat.SpaceBefore=12;$st.ParagraphFormat.SpaceAfter=6;$st.ParagraphFormat.KeepWithNext=-1
    $st=Set-Style -63 36 $true 1;$st.ParagraphFormat.SpaceBefore=10
    foreach($name in @('Cover Heading','Cover Meta','Equation','TOC Title')){$null=$doc.Styles.Add($name,1)}
    $st=Set-Style 'Cover Heading' 26 $false 1;$st.ParagraphFormat.SpaceBefore=70
    $st=Set-Style 'Cover Meta' 16 $false 1;$st.ParagraphFormat.SpaceBefore=18
    $null=Set-Style 'TOC Title' 18 $true 1
    $st=Set-Style 'Equation' 12;$st.ParagraphFormat.SpaceBefore=6;$st.ParagraphFormat.SpaceAfter=6;$st.ParagraphFormat.KeepTogether=-1
    $st.ParagraphFormat.TabStops.ClearAll();$null=$st.ParagraphFormat.TabStops.Add($word.MillimetersToPoints(82.5),1,0);$null=$st.ParagraphFormat.TabStops.Add($word.MillimetersToPoints(165),2,0)
    $st=Set-Style -35 12 $false 1;$st.ParagraphFormat.KeepWithNext=-1
    $null=Set-Style -32 10.5 $false 1; $null=Set-Style -33 10.5 $false 1
    foreach($id in @(-20,-21)){$null=Set-Style $id 12}
    $doc.Sections.Item(1).Headers.Item(1).Range.Text=$f.layout.headerText
    $footer=$doc.Sections.Item(1).Footers.Item(1).Range;$footer.ParagraphFormat.Alignment=1;$null=$doc.Fields.Add($footer,33)
    $null=Add-Text '国网科技报告风格样稿' 'Cover Heading'
    $null=Add-Text '技术路线对比报告' -63
    $r=Add-Text ('项目名称  '+$f.title) 'Cover Meta';$r.ParagraphFormat.SpaceBefore=100
    $null=Add-Text '文档用途  排版与公式转换实验' 'Cover Meta'
    $null=Add-Text '编制日期  2026 年 10 月 10 日' 'Cover Meta'
    Add-Break
    $null=Add-Text '目录' 'TOC Title';$null=Add-Text '@TOC@'
    Add-Break
    $null=Add-Text ('一、'+$f.headings[0].text) -2
    $null=Add-Text $f.paragraphs[0].text
    $null=Add-Text ($f.paragraphs[1].textBeforeEquation+'@MATH0@'+$f.paragraphs[1].textAfterEquation)
    $null=Add-Text ('参见表 @REFTABLE@ 和式（@REFEQ@）。'+$f.paragraphs[2].text)
    $null=Add-Text ('二、'+$f.headings[1].text) -2
    for($n=1;$n -le 5;$n++){
        if($n -eq 3){$null=Add-Text ('（一）'+$f.headings[2].text) -3}
        $null=Add-Text ("`t@MATH$n@`t（@SEQ$n@）") 'Equation'
    }
    Add-Break
    $null=Add-Text ('三、'+$f.headings[3].text) -2
    $null=Add-Text ('表 @TABLE@ '+$f.table.caption) -35
    $t=$doc.Tables.Add($doc.Range($doc.Content.End-1,$doc.Content.End-1),41,4)
    $t.AllowAutoFit=$false;$t.Borders.Enable=1;$t.Rows.AllowBreakAcrossPages=0;$t.Rows.Item(1).HeadingFormat=-1
    $t.Range.Font.Name='Times New Roman';$t.Range.Font.NameFarEast='仿宋';$t.Range.Font.Size=12
    $t.Range.ParagraphFormat.FirstLineIndent=0;$t.Range.ParagraphFormat.Alignment=1;$t.Range.ParagraphFormat.SpaceBefore=0;$t.Range.ParagraphFormat.SpaceAfter=0;$t.Range.ParagraphFormat.LineSpacingRule=1
    for($j=1;$j -le 4;$j++){$t.Columns.Item($j).Width=$word.MillimetersToPoints($f.table.columnWidthsMm[$j-1]);$t.Cell(1,$j).Range.Text=$f.table.headers[$j-1]}
    $t.Rows.Item(1).Range.Font.Bold=-1
    for($i=1;$i -le 40;$i++){
        for($j=1;$j -le 4;$j++){$value=[string]$f.table.rows[($i-1)%4][$j-1];if($j -eq 1){$value+=' '+$i};$t.Cell($i+1,$j).Range.Text=$value}
    }
    $linear=@('i_(L) (t)=I_0+Δi sin(ωt)','H(s)=1/(LCs^2+RCs+1)','E=∫_0^T▒v(t)i(t)ⅆt','A=[■(0&1@-ω_0^2&-2ζω_0)]','u(t)={■(U_("dc"),&t≥0@0,&t<0)┤','█(v_L&=L (ⅆi_L)/(ⅆt)@i_C&=C (ⅆv_C)/(ⅆt))')
    for($i=0;$i -lt 6;$i++){
        Write-Output "Build Word equation $i"
        $r=$doc.Content.Duplicate;if(-not $r.Find.Execute("@MATH$i@")){throw "Missing math $i"}
        $start=$r.Start;$r.Text=$linear[$i];$r=$doc.Range($start,$start+$linear[$i].Length)
        $math=$doc.OMaths.Add($r);$math.OMaths.Item(1).BuildUp()
        if($i -eq 3){
            $letter=$doc.OMaths.Item(4).Range.Duplicate
            # Math letters become Unicode surrogate pairs after BuildUp; never split one by Start+1.
            if(-not $letter.Find.Execute([char]::ConvertFromUtf32(0x1D434))){throw 'Matrix symbol A not found'}
            $letter.Font.Bold=-1;$letter.Font.Italic=0
        }
    }
    for($i=1;$i -le 5;$i++){Replace-Field "@SEQ$i@" 'SEQ Equation \* ARABIC' $(if($i -eq 1){'EqFraction'}else{''})}
    Replace-Field '@TABLE@' 'SEQ Table \* ARABIC' 'TableParameters'
    Replace-Field '@REFTABLE@' 'REF TableParameters \h';Replace-Field '@REFEQ@' 'REF EqFraction \h'
    Replace-Field '@TOC@' 'TOC \o "1-2" \h \z \u'
    $path=Join-Path $OutputDirectory 'word-com.raw.docx';$doc.SaveAs2($path,16)
    [pscustomobject]@{wordVersion=$word.Version;wordBuild=$word.Build;startupSeconds=$startup;generationSeconds=$timer.Elapsed.TotalSeconds-$startup;mathCount=$doc.OMaths.Count;mathInput='Word native UnicodeMath BuildUp'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'word-com-generation.json')
    Write-Output $path
} finally {if($doc){$doc.Close(0)};if($word){$word.Quit()};[GC]::Collect();[GC]::WaitForPendingFinalizers()}
