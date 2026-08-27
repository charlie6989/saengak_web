param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Title,
    [Parameter(Mandatory=$true)][string]$Link,
    [Parameter(Mandatory=$true)][string]$Store,
    [Parameter(Mandatory=$true)][int]$CleanCount,
    [Parameter(Mandatory=$true)][int]$MainCount,
    [Parameter(Mandatory=$true)][int]$VariantCount,
    [Parameter(Mandatory=$true)][string]$InventorySummary,
    [Parameter(Mandatory=$true)][string]$PriceSummary,
    [Parameter(Mandatory=$true)][string]$Reason
)

$resultPath = Join-Path $Path "處理結果.txt"
$lines = @(
    "商品標題: $Title",
    "商品鏈接: $Link",
    "店鋪名稱: $Store",
    "商品資料夾: $Path",
    "清理圖片數量: $CleanCount（主圖 $MainCount 張、規格圖片 $VariantCount 張）",
    "庫存數量: $InventorySummary",
    "價格: $PriceSummary",
    "Shopify 商品 ID: 待確認",
    "Shopify 上傳狀態: 未上傳",
    "未上傳原因: $Reason",
    "Shopify 後台連結: 待確認"
)
[System.IO.File]::WriteAllLines($resultPath, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Output $resultPath
