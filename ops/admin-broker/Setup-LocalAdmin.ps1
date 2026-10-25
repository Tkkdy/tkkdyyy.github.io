# Owner-invoked setup only. Does not create GitHub accounts/apps or change any server.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$ClientId,
 [string]$Branch='codex/admin-local-probe',
 [string]$ConfigPath=(Join-Path $env:LOCALAPPDATA 'EditorialStudio\local-broker.json'),
 [string]$StaticRoot=(Join-Path $PSScriptRoot '..\..\dist-admin')
)
$ErrorActionPreference='Stop'
if ($Branch -eq 'main') { throw 'Local setup defaults to a test branch; main requires separate reviewed configuration.' }
if (Test-Path -LiteralPath $ConfigPath) { throw 'Existing configuration will not be overwritten.' }
$resolvedStatic=(Resolve-Path -LiteralPath $StaticRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $resolvedStatic 'admin\index.html'))) { throw 'Build the private Admin artifact first.' }
$secret=Read-Host 'GitHub App client secret (encrypted for this Windows user)' -AsSecureString
$encrypted=ConvertFrom-SecureString -SecureString $secret
$record=[ordered]@{schema=1;origin='http://127.0.0.1:19443';listenPort=19443;repository='Tkkdy/tkkdyyy.github.io';repositoryId=1355866312;ownerId=144055705;branch=$Branch;allowMain=$false;clientId=$ClientId;encryptedClientSecret=$encrypted;staticRoot=$resolvedStatic;targets=@{pages='https://tkkdy.github.io/tkkdyyy.github.io/';vps='https://preview.boenbot.top/'}}
$parent=Split-Path -Parent $ConfigPath
if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
# DPAPI ciphertext is user-bound. CreateNew refuses races/overwrites; no secret is printed.
$stream=[System.IO.File]::Open($ConfigPath,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
try {$bytes=[System.Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Depth 5));$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose();$secret.Dispose()}
Write-Output 'Local editor configuration saved using Windows user DPAPI. No server or GitHub permission changed.'
