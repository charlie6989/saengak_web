param(
    [Parameter(Mandatory = $true)] [string]$Path,
    [Parameter(Mandatory = $true)] [string]$PriceBlock,
    [Parameter(Mandatory = $true)] [string]$InventoryBlock
)

$ErrorActionPreference = 'Stop'
$content = [IO.File]::ReadAllText($Path)
$content = [regex]::Replace($content, '(?ms)^價格:\r?\n.*?(?=^庫存:)', "價格:`n$PriceBlock`n`n")
$content = [regex]::Replace($content, '(?ms)^庫存:\r?\n.*?(?=^主圖:)', "庫存:`n$InventoryBlock`n`n")
[IO.File]::WriteAllText($Path, $content, (New-Object Text.UTF8Encoding($false)))
Write-Output "已更新來源資訊：$Path"
