param([Parameter(Mandatory)][string]$OutputDirectory,[switch]$ReferenceOnly)
$ErrorActionPreference='Stop';$word=$null;$doc=$null
$labRoot=Split-Path $PSScriptRoot -Parent
try {
    $word=New-Object -ComObject Word.Application;$word.Visible=$false;$word.DisplayAlerts=0;$word.AutomationSecurity=3
    if($ReferenceOnly){
        $doc=$word.Documents.Open((Join-Path $labRoot 'templates/sgcc-feasibility-2018-original.docx'),$false,$true)
        $doc.ExportAsFixedFormat((Join-Path $OutputDirectory 'source-template.pdf'),17)
        $doc.Close(0);$doc=$null;return
    }
    $records=@()
    foreach($route in @('word-com','pandoc','direct-docx')){
        $inputName=if($route -eq 'pandoc'){'pandoc.prepared.docx'}else{"$route.raw.docx"}
        $timer=[Diagnostics.Stopwatch]::StartNew()
        $doc=$word.Documents.Open((Join-Path $OutputDirectory $inputName),$false,$false)
        $open=$timer.Elapsed.TotalSeconds
        $null=$doc.Fields.Update()
        foreach($toc in $doc.TablesOfContents){$toc.Update()}
        $doc.Repaginate();foreach($toc in $doc.TablesOfContents){$toc.UpdatePageNumbers()}
        $final=Join-Path $OutputDirectory "$route.docx";$doc.SaveAs2($final,16)
        $save=$timer.Elapsed.TotalSeconds
        $doc.Close(0);$doc=$null
        $doc=$word.Documents.Open($final,$false,$false)
        $doc.Repaginate();$pdf=Join-Path $OutputDirectory "$route.pdf";$doc.ExportAsFixedFormat($pdf,17)
        $record=[ordered]@{route=$route;wordVersion=$word.Version;wordBuild=$word.Build;openSeconds=$open;updateSaveSeconds=$save-$open;reopenExportSeconds=$timer.Elapsed.TotalSeconds-$save;pages=$doc.ComputeStatistics(2);equations=$doc.OMaths.Count;tables=$doc.Tables.Count;rows=$doc.Tables.Item(1).Rows.Count;toc=$doc.TablesOfContents.Count;fields=$doc.Fields.Count;formulaText=@();editCheck=$false}
        foreach($math in $doc.OMaths){$record.formulaText+= $math.Range.Text}
        # Work on a separately named edit copy: modify the denominator constant using Word's equation range.
        $r=$doc.OMaths.Item(2).Range.Duplicate;$r.Find.ClearFormatting();$r.Find.Text='1';$r.Find.Forward=$false;$r.Find.Wrap=0
        if(-not $r.Find.Execute()){throw 'Denominator constant not found'}
        $r.Text='2';$edited=Join-Path $OutputDirectory "$route.edit-check.docx";$doc.SaveAs2($edited,16);$doc.Close(0);$doc=$null
        $doc=$word.Documents.Open($edited,$false,$true)
        $record.editedFraction=$doc.OMaths.Item(2).Range.Text
        $record.editCheck=($doc.OMaths.Count -eq 6 -and $record.editedFraction -match '2')
        $records+=[pscustomobject]$record;$doc.Close(0);$doc=$null
        Write-Output "$route pages=$($record.pages) equations=$($record.equations) edit=$($record.editCheck)"
    }
    $records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'word-verification.json')
} finally {if($doc){$doc.Close(0)};if($word){$word.Quit()};[GC]::Collect();[GC]::WaitForPendingFinalizers()}
