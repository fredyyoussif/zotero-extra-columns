# Builds extra-columns.xpi from the plugin sources.
#
# Uses .NET's ZipArchive directly because Windows PowerShell 5.1's Compress-Archive
# writes backslashes in entry paths, and Zotero can't load "content\main.js".

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
$output = Join-Path $root "extra-columns.xpi"
$include = @("manifest.json", "bootstrap.js", "prefs.js", "content", "locale")

if (Test-Path -LiteralPath $output) {
    Remove-Item -LiteralPath $output -Force
}

$zip = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Create)
try {
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

Write-Output "Built $output"
