#requires -Version 7
<#
.SYNOPSIS
  Bezpečná offline záloha dat MSFS Companion před migrací.
.DESCRIPTION
  Bez parametru -Execute jen zobrazí plán. Nikdy nemaže ani neobnovuje.
  Po kopírování ověřuje každou souborovou kopii pomocí SHA256.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Destination,
    [string]$Source = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MSFS Companion'),
    [switch]$Execute
)
$ErrorActionPreference = 'Stop'
$src = [IO.Path]::GetFullPath($Source).TrimEnd('\', '/')
$dest = [IO.Path]::GetFullPath($Destination).TrimEnd('\', '/')
if (-not (Test-Path -LiteralPath $src -PathType Container)) {
    throw "Zdrojový adresář neexistuje: $src"
}
if ([string]::Equals($src, $dest, [StringComparison]::OrdinalIgnoreCase) -or
    $dest.StartsWith(($src + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Zálohu nelze ukládat uvnitř původních dat.'
}
$items = @(Get-ChildItem -LiteralPath $src -Recurse -Force)
if (@($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -gt 0) {
    throw 'Zdroj obsahuje symlink/junction; kopírování bylo bezpečně odmítnuto.'
}
$files = @($items | Where-Object { -not $_.PSIsContainer })
$bytes = [long]0
foreach ($item in $files) { $bytes += $item.Length }
Write-Host ("ZDROJ: {0}" -f $src)
Write-Host ("CÍL: {0}" -f $dest)
Write-Host ("SOUBORY: {0}, BYTES: {1}" -f $files.Count, $bytes)
if (-not $Execute) {
    Write-Host 'KONTROLNÍ REŽIM: nic nebylo změněno. K zápisu použijte -Execute.'
    return
}
New-Item -ItemType Directory -Path $dest -Force | Out-Null
$folder = 'MSFS-Companion-Airbus-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' +
    [guid]::NewGuid().ToString('N').Substring(0, 8)
$root = Join-Path $dest $folder
if (Test-Path -LiteralPath $root) { throw "Záloha již existuje: $root" }
New-Item -ItemType Directory -Path $root | Out-Null
$target = Join-Path $root 'MSFS Companion'
New-Item -ItemType Directory -Path $target | Out-Null
foreach ($item in @(Get-ChildItem -LiteralPath $src -Force)) {
    Copy-Item -LiteralPath $item.FullName -Destination $target -Recurse -Force
}
$verified = @()
foreach ($item in $files) {
    $relative = $item.FullName.Substring($src.Length).TrimStart('\', '/')
    $copied = Join-Path $target $relative
    if (-not (Test-Path -LiteralPath $copied -PathType Leaf)) {
        throw "V záloze chybí: $relative"
    }
    $hashA = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash
    $hashB = (Get-FileHash -LiteralPath $copied -Algorithm SHA256).Hash
    if ($hashA -ne $hashB -or $item.Length -ne (Get-Item -LiteralPath $copied).Length) {
        throw "Záloha se neshoduje se zdrojem: $relative"
    }
    $verified += [pscustomobject]@{ path = $relative; bytes = $item.Length; sha256 = $hashB }
}
$manifest = @{
    schemaVersion = 1
    createdUtc = [DateTimeOffset]::UtcNow.ToString('O')
    fileCount = $files.Count
    totalBytes = $bytes
    files = $verified
}
ConvertTo-Json -InputObject $manifest -Depth 6 |
    Set-Content -LiteralPath (Join-Path $root 'manifest-sha256.json') -Encoding utf8
Write-Host 'ZÁLOHA ÚSPĚŠNÁ: vše ověřeno SHA256. Uchovejte ji mimo herní disk.'
Write-Output ('BACKUP_OK ' + $root)
