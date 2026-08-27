param(
    [Parameter(Mandatory = $true)] [string]$Path,
    [Parameter(Mandatory = $true)] [string]$Title,
    [Parameter(Mandatory = $true)] [string]$Link,
    [Parameter(Mandatory = $true)] [string]$Store,
    [Parameter(Mandatory = $true)] [int]$CleanCount,
    [Parameter(Mandatory = $true)] [int]$MainCount,
    [Parameter(Mandatory = $true)] [int]$VariantCount,
    [Parameter(Mandatory = $true)] [string]$InventorySummary,
    [Parameter(Mandatory = $true)] [string]$PriceSummary,
    [Parameter(Mandatory = $true)] [string]$ProductId,
    [string]$UploadStatus = '成功；DRAFT；規格庫存已同步'
)

$ErrorActionPreference = 'Stop'
$numericId = $ProductId -replace '^gid://shopify/Product/', ''
$adminUrl = "https://gh2xgs-zf.myshopify.com/admin/products/$numericId"
$folder = Split-Path -Parent $Path
$content = @(
    "商品標題: $Title"
    "商品資料夾: $folder"
    "商品鏈接: $Link"
    "店鋪名稱: $Store"
    "清理圖片數量: $CleanCount 張（主圖 $MainCount 張、規格圖 $VariantCount 張）"
    "蝦皮確認庫存: $InventorySummary"
    "蝦皮售價: $PriceSummary"
    "Shopify 商品 ID: $ProductId"
    "Shopify 上傳狀態: $UploadStatus"
    "Shopify 後台連結: $adminUrl"
) -join "`n"
[IO.File]::WriteAllText((Join-Path $folder '上傳結果.txt'), $content, (New-Object Text.UTF8Encoding($false)))
Write-Output "已建立上傳結果：$(Join-Path $folder '上傳結果.txt')"
