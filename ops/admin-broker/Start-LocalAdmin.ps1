[CmdletBinding()]
param([string]$ConfigPath=(Join-Path $env:LOCALAPPDATA 'EditorialStudio\local-broker.json'))
$ErrorActionPreference='Stop'
$record=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json -AsHashtable
if ($record.schema -ne 1 -or -not $record.encryptedClientSecret) { throw 'Unknown local configuration.' }
# Existing schema-1 records without publicationMode retain direct test-branch behavior.
$mode=if ($record.ContainsKey('publicationMode')) {$record.publicationMode} else {'direct'}
if ($mode -notin @('direct','pull-request') -or ($record.allowMain -isnot [bool] -or $record.allowMain) -or [string]::IsNullOrWhiteSpace($record.branch)) { throw 'Local publication configuration is not allowed.' }
if (($mode -eq 'pull-request' -and $record.branch -ne 'main') -or ($mode -eq 'direct' -and $record.branch -eq 'main')) { throw 'Local main writes are forbidden; PR preparation must read main.' }
if ($record.listenPort -isnot [long] -and $record.listenPort -isnot [int]) { throw 'Invalid loopback port.' }
if ($record.listenPort -lt 1024 -or $record.listenPort -gt 65535 -or $record.origin -cne ('http://127.0.0.1:'+ $record.listenPort)) { throw 'Local launcher only permits the exact loopback origin.' }
$secure=ConvertTo-SecureString -String $record.encryptedClientSecret
$pointer=[IntPtr]::Zero
try {
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 $record.clientSecret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
 $record.Remove('encryptedClientSecret')
 # Pipeline passes the secret on stdin; it is never an argument or output line.
 $record | ConvertTo-Json -Depth 5 -Compress | & node (Join-Path $PSScriptRoot 'run.mjs') --stdin-config
 if ($LASTEXITCODE -ne 0) { throw 'Local editor exited unsuccessfully.' }
} finally {
 if ($pointer -ne [IntPtr]::Zero) {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
 $record.Remove('clientSecret');$secure.Dispose()
}
