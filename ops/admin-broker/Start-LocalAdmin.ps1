[CmdletBinding()]
param([string]$ConfigPath=(Join-Path $env:LOCALAPPDATA 'EditorialStudio\local-broker.json'))
$ErrorActionPreference='Stop'
$record=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json -AsHashtable
if ($record.schema -ne 1 -or -not $record.encryptedClientSecret) { throw 'Unknown local configuration.' }
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
