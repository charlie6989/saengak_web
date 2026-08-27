param(
    [Parameter(Mandatory = $true)] [string]$SourceUrl,
    [Parameter(Mandatory = $true)] [int]$ExpectedCount,
    [string]$DownloadRoot = 'C:\Users\master\Downloads',
    [string]$ProductRoot = 'C:\Projects\saengak_web\product'
)

$ErrorActionPreference = 'Stop'

$downloadMetaFiles = @(Get-ChildItem -LiteralPath $DownloadRoot -File -Filter '下載*.txt' |
    Where-Object { (Get-Content -Raw -LiteralPath $_.FullName) -like "*$SourceUrl*" } |
    Sort-Object LastWriteTime)

$downloadMetaFiles = @($downloadMetaFiles |
    Group-Object {
        $downloadText = Get-Content -Raw -LiteralPath $_.FullName
        [regex]::Match($downloadText, 'https?://down-tw\.img\.susercontent\.com/file/\S+').Value
    } |
    ForEach-Object { $_.Group | Select-Object -First 1 })

if ($downloadMetaFiles.Count -eq 0) { throw 'Downloads 中找不到這個商品的 AiPrice 下載資訊。' }
$downloadTexts = @($downloadMetaFiles | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName })
$titleMatch = [regex]::Match($downloadTexts[0], '(?ms)商品標題:\s*\r?\n(?<v>.+?)\r?\n商品鏈接:')
if (!$titleMatch.Success) { throw 'AiPrice 資訊中找不到商品標題。' }
$title = $titleMatch.Groups['v'].Value.Trim()

$safeName = [regex]::Replace($title, '[<>:"/\\|?*]', '_').Trim().TrimEnd('.')
if ($safeName.Length -gt 180) { $safeName = $safeName.Substring(0, 180).TrimEnd('.', ' ') }
if ([string]::IsNullOrWhiteSpace($safeName)) { throw '商品標題無法轉成有效資料夾名稱。' }
$target = Join-Path $ProductRoot $safeName

$existingMetaFiles = @()
if (Test-Path -LiteralPath $target) {
    if (Test-Path -LiteralPath (Join-Path $target '_URL.txt')) { throw "商品資料夾已完成整理，為避免覆寫而停止：$target" }
    $existingInfoDir = Join-Path $target '來源資訊'
    if (!(Test-Path -LiteralPath $existingInfoDir)) { throw "商品資料夾已存在但缺少來源資訊目錄：$target" }
    $existingMetaFiles = @(Get-ChildItem -LiteralPath $existingInfoDir -File -Filter 'AiPrice_*.txt' | Sort-Object Name)
    foreach ($existingMetaFile in $existingMetaFiles) {
        if ((Get-Content -Raw -LiteralPath $existingMetaFile.FullName) -notlike "*$SourceUrl*") {
            throw "既有部分整理資訊不是同一個商品：$($existingMetaFile.Name)"
        }
    }
}

$totalMetaCount = $existingMetaFiles.Count + $downloadMetaFiles.Count
if ($totalMetaCount -ne $ExpectedCount) {
    throw "AiPrice 下載資訊數量不符：預期 $ExpectedCount 份，已整理 $($existingMetaFiles.Count) 份，Downloads 有 $($downloadMetaFiles.Count) 份。"
}

$texts = @($existingMetaFiles + $downloadMetaFiles | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName })

New-Item -ItemType Directory -Force -Path (Join-Path $target '主圖') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target '規格圖') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target '來源資訊') | Out-Null

$storeMatch = [regex]::Match($texts[0], '(?ms)店鋪名稱:\s*\r?\n(?<name>.+?)\r?\n(?<url>https?://\S+)')
$storeName = $storeMatch.Groups['name'].Value.Trim()
$storeUrl = $storeMatch.Groups['url'].Value.Trim()
$mainUrls = @()
$variantUrls = @()
$mainIndex = 0
$variantIndex = 0
$infoIndex = $existingMetaFiles.Count

foreach ($existingMetaFile in $existingMetaFiles) {
    $existingText = Get-Content -Raw -LiteralPath $existingMetaFile.FullName
    if ($existingText -match '(?ms)主圖:\s*\r?\n(?<u>https?://\S+)') {
        $mainIndex++
        $mainUrls += $Matches['u'].Trim()
    } elseif ($existingText -match '(?ms)(SKU 属性图|SKU 属性圖|規格圖|規格图|屬性圖|属性图):\s*\r?\n(?<u>https?://\S+)') {
        $variantIndex++
        $variantUrls += $Matches['u'].Trim()
    } else {
        throw "無法辨識既有 AiPrice 下載資訊：$($existingMetaFile.Name)"
    }
}

foreach ($metaFile in $downloadMetaFiles) {
    $text = Get-Content -Raw -LiteralPath $metaFile.FullName
    if ($text -match '(?ms)主圖:\s*\r?\n(?<u>https?://\S+)') {
        $kind = 'main'
        $imageUrl = $Matches['u'].Trim()
        $mainIndex++
        $destinationDir = Join-Path $target '主圖'
        $mainUrls += $imageUrl
    } elseif ($text -match '(?ms)(SKU 属性图|SKU 属性圖|規格圖|規格图|屬性圖|属性图):\s*\r?\n(?<u>https?://\S+)') {
        $kind = 'variant'
        $imageUrl = $Matches['u'].Trim()
        $variantIndex++
        $destinationDir = Join-Path $target '規格圖'
        $variantUrls += $imageUrl
    } else {
        throw "無法辨識 AiPrice 下載資訊：$($metaFile.Name)"
    }

    $imageName = [IO.Path]::GetFileName(([uri]$imageUrl).AbsolutePath)
    $imagePath = Join-Path $DownloadRoot $imageName
    if (!(Test-Path -LiteralPath $imagePath)) {
        $imageStem = [IO.Path]::GetFileNameWithoutExtension($imageName)
        $candidates = @(Get-ChildItem -LiteralPath $DownloadRoot -File | Where-Object { $_.BaseName -eq $imageStem })
        if ($candidates.Count -ne 1) { throw "找不到唯一對應圖片：$imageName" }
        $imagePath = $candidates[0].FullName
    }
    $extension = [IO.Path]::GetExtension(([uri]$imageUrl).AbsolutePath)
    if ([string]::IsNullOrWhiteSpace($extension)) { $extension = [IO.Path]::GetExtension($imagePath) }
    if ($kind -eq 'main') { $destinationName = ('原始_主圖_{0:D2}' -f $mainIndex) + $extension }
    else { $destinationName = ('原始_規格_{0:D2}' -f $variantIndex) + $extension }
    Move-Item -LiteralPath $imagePath -Destination (Join-Path $destinationDir $destinationName)
    $infoIndex++
    Move-Item -LiteralPath $metaFile.FullName -Destination (Join-Path (Join-Path $target '來源資訊') ('AiPrice_{0:D2}.txt' -f $infoIndex))
}

$urlLines = @(
    '店鋪名稱:', $storeName, $storeUrl, '',
    '商品標題:', $title, '',
    '商品鏈接:', $SourceUrl, '',
    '價格:', '待確認', '',
    '庫存:', '待確認', '',
    '主圖:'
) + $mainUrls + @('', '規格圖:') + $variantUrls
[IO.File]::WriteAllText((Join-Path $target '_URL.txt'), ($urlLines -join "`n"), (New-Object Text.UTF8Encoding($false)))

[pscustomobject]@{
    Target = $target
    Title = $title
    Main = $mainUrls.Count
    Variants = $variantUrls.Count
    Store = $storeName
} | ConvertTo-Json -Compress
