# Builds build/extra-columns.xpi and build/updates.json.
#
# The version is never stored in the repository. manifest.json and updates.json
# are templates with {{VERSION}} placeholders; this script fills them in.
# Releases get the version from the git tag (see .github/workflows/build.yml).
#
#   .\build.ps1 -Version 0.1.2
#
# Uses .NET's ZipArchive directly because Windows PowerShell 5.1's Compress-Archive
# writes backslashes in entry paths, and Zotero can't load "content\main.js".

param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Zotero plugin versions are up to four dot-separated numbers, e.g. 1.2.3.
if ($Version -notmatch '^\d+(\.\d+){0,3}$') {
    throw "Version '$Version' must be numbers separated by dots, for example 0.1.2"
}

$root = $PSScriptRoot
$outDir = Join-Path $root "build"
$xpiPath = Join-Path $outDir "extra-columns.xpi"
$updatesPath = Join-Path $outDir "updates.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Expand-Template([string]$name, [hashtable]$values) {
    $text = [System.IO.File]::ReadAllText((Join-Path $root $name))
    foreach ($key in $values.Keys) {
        $text = $text.Replace("{{$key}}", $values[$key])
    }
    if ($text -match '\{\{(\w+)\}\}') {
        throw "$name has a placeholder with no value: {{$($Matches[1])}}"
    }
    $null = $text | ConvertFrom-Json  # fail early on invalid JSON
    return $text
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (Test-Path -LiteralPath $xpiPath) {
    Remove-Item -LiteralPath $xpiPath -Force
}

# manifest.json
$manifestText = Expand-Template "manifest.json" @{ VERSION = $Version }
$zotero = ($manifestText | ConvertFrom-Json).applications.zotero

# The XPI
$include = @("bootstrap.js", "prefs.js", "content", "locale")
$zip = [System.IO.Compression.ZipFile]::Open($xpiPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $entry = $zip.CreateEntry("manifest.json", [System.IO.Compression.CompressionLevel]::Optimal)
    $writer = New-Object System.IO.StreamWriter($entry.Open(), $utf8NoBom)
    try { $writer.Write($manifestText) } finally { $writer.Dispose() }
    Write-Output "  added manifest.json (version $Version)"

    foreach ($name in $include) {
        $path = Join-Path $root $name
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Missing $name"
        }
        $item = Get-Item -LiteralPath $path
        if ($item.PSIsContainer) {
            $files = Get-ChildItem -LiteralPath $path -Recurse -File
        }
        else {
            $files = @($item)
        }
        foreach ($file in $files) {
            $entryName = $file.FullName.Substring($root.Length).TrimStart('\', '/') -replace '\\', '/'
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
            Write-Output "  added $entryName"
        }
    }
}
finally {
    $zip.Dispose()
}

# updates.json, which Zotero reads through the manifest's update_url
$updatesText = Expand-Template "updates.json" @{
    VERSION            = $Version
    ID                 = $zotero.id
    STRICT_MIN_VERSION = $zotero.strict_min_version
    XPI_SHA256         = (Get-FileHash -Algorithm SHA256 -LiteralPath $xpiPath).Hash.ToLower()
}
[System.IO.File]::WriteAllText($updatesPath, $updatesText, $utf8NoBom)

Write-Output "Built $xpiPath"
Write-Output "Built $updatesPath"
