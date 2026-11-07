$ErrorActionPreference = 'Stop'
$root = Join-Path $env:RUNNER_TEMP ('msfs-backup-test-'+[guid]::NewGuid().ToString('N'))
$source = Join-Path $root 'input'
$dest = Join-Path $root 'output'
try {
    New-Item -ItemType Directory -Path (Join-Path $source 'flights') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $source 'settings.json') -Value '{"MdnsEnabled":true}' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $source 'flights/test-flight.jsonl') -Value '{"sample":1}' -Encoding utf8
    & ./scripts/backup-airbus-migration.ps1 -Source $source -Destination $dest
    if (Test-Path -LiteralPath $dest) { throw 'Dry run unexpectedly wrote files' }
    $result = & ./scripts/backup-airbus-migration.ps1 -Source $source -Destination $dest -Execute
    $last = @($result | Where-Object { $_ -match '^BACKUP_OK ' }) | Select-Object -Last 1
    if (!$last) { throw 'Success line missing' }
    $backup = $last.Substring('BACKUP_OK '.Length)
    if (!(Test-Path -LiteralPath (Join-Path $backup 'MSFS Companion/settings.json'))) {
        throw 'Settings not backed up'
    }
    if (!(Test-Path -LiteralPath (Join-Path $backup 'MSFS Companion/flights/test-flight.jsonl'))) {
        throw 'Flight recording not backed up'
    }
    $manifest = Get-Content -LiteralPath (Join-Path $backup 'manifest-sha256.json') -Raw | ConvertFrom-Json
    if ($manifest.fileCount -ne 2 -or $manifest.files.Count -ne 2) {
        throw 'Missing hash manifest entries'
    }
    $setting = $manifest.files | Where-Object { $_.path -eq 'settings.json' } | Select-Object -First 1
    if ($setting.sha256 -ne (Get-FileHash -LiteralPath (Join-Path $source 'settings.json') -Algorithm SHA256).Hash) {
        throw 'Manifest sha256 mismatch'
    }
    Write-Host 'PASS: dry run, copy, SHA256 and settings/flights persistence'
} finally {
    if (Test-Path -LiteralPath $root) {
        Remove-Item -LiteralPath $root -Recurse -Force
    }
}
