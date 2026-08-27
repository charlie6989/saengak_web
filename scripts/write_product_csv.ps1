param(
    [Parameter(Mandatory = $true)] [string]$Path,
    [Parameter(Mandatory = $true)] [string]$Title,
    [string]$BodyHtml = '',
    [string]$VariantsJson = '[]',
    [string]$Category = [char]0x8212 + [char]0x9069 + [char]0x7A7F + [char]0x8457, # 舒適穿著
    [string]$Tags = 'SAENGAK',
    [string]$Price = '',
    [string]$CompareAtPrice = '',
    [string]$Option1Name = [char]0x9844 + [char]0x8272, # 顏色
    [string]$Option2Name = [char]0x5C3A + [char]0x5BF8  # 尺寸
)

$ErrorActionPreference = 'Stop'

# 1. 標題去識別化與清洗
$cleanTitle = $Title -replace '(?i)LUCISSI', '' -replace '(?i)medion', ''
$cleanTitle = $cleanTitle.Trim()
if ([string]::IsNullOrWhiteSpace($cleanTitle)) {
    $cleanTitle = $Title.Trim()
}

# 2. 規格陣列解析
$variants = @($VariantsJson | ConvertFrom-Json)
if ($variants.Count -eq 0) { 
    $variants = @([PSCustomObject]@{ value = 'Default Option'; inventory = 0 })
}

# 3. 結構化 HTML 內文產出 (對齊 shopify-universal-csv 規範，嚴禁寫入蝦皮/來源資訊)
if ([string]::IsNullOrWhiteSpace($BodyHtml)) {
    $BodyHtml = "<p>$cleanTitle</p><h3>商品特色</h3><ul><li><strong>親膚透氣</strong>：優質親膚面料，柔軟細緻，吸濕排汗不悶熱。</li><li><strong>精緻工藝</strong>：立體剪裁與細膩車縫，服貼不勒肉，呈現自然優美身形。</li><li><strong>百搭實穿</strong>：簡約典雅色系，適合各種日常與居家場合搭配。</li></ul><h3>規格說明</h3><ul><li><strong>商品品類</strong>：$Category</li><li><strong>商品規格</strong>：請依規格選單挑選合適款式</li></ul><h3>洗滌與保養建議</h3><p>建議使用冷水搭配中性洗劑輕柔手洗，或裝入細網洗衣袋機洗；置於通風陰涼處自然晾乾。</p>"
}

# 4. 依照 Shopify Universal CSV 標準產出記錄
$records = foreach ($variant in $variants) {
    $val = [string]$variant.value
    $opt1Val = $val
    $opt2Val = ''

    if ($val -match '^(.+?)[,\/](.+)$') {
        $opt1Val = $Matches[1].Trim()
        $opt2Val = $Matches[2].Trim()
    }

    $invQty = 0
    if ($null -ne $variant.inventory) {
        $invQty = [int]$variant.inventory
    }

    $rowObj = [ordered]@{
        'Title'                    = $cleanTitle
        'Body (HTML)'              = $BodyHtml
        'Vendor'                   = 'SAENGAK'
        'Product Category'         = $Category
        'Type'                     = $Category
        'Tags'                     = "$Category, SAENGAK"
        'Published'                = 'FALSE'
        'Option1 Name'             = $Option1Name
        'Option1 Value'            = $opt1Val
    }

    if (![string]::IsNullOrWhiteSpace($opt2Val)) {
        $rowObj['Option2 Name']  = $Option2Name
        $rowObj['Option2 Value'] = $opt2Val
    }

    $rowObj['Variant Inventory Qty']    = $invQty
    $rowObj['Variant Inventory Policy'] = 'deny'
    $rowObj['Variant Price']            = $Price
    $rowObj['Variant Compare At Price'] = $CompareAtPrice
    $rowObj['Status']                   = 'DRAFT'

    $rowObj
}

$csv = ($records | ConvertTo-Csv -NoTypeInformation) -join "`n"
$outputCsvPath = if ($Path.EndsWith('.csv')) { $Path } else { Join-Path (Split-Path -Parent $Path) 'shopify-new-product.csv' }
[IO.File]::WriteAllText($outputCsvPath, $csv, (New-Object Text.UTF8Encoding($false)))
Write-Output "已建立 Shopify 文案 CSV：$outputCsvPath"
