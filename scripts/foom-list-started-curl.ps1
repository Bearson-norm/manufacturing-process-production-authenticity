<#
.SYNOPSIS
  Fetch FOOM GET /api/v1/manufacturing and print rows where status == "started".
  Uses curl.exe (not Invoke-WebRequest). No jq required.

.EXAMPLE
  $env:EXTERNAL_API_BASE_URL = "https://foom-api.kyuantum.com"
  $env:EXTERNAL_API_BEARER_TOKEN = "your-token"
  .\scripts\foom-list-started-curl.ps1
#>
param(
  [string] $BaseUrl = $env:EXTERNAL_API_BASE_URL,
  [string] $Token = $env:EXTERNAL_API_BEARER_TOKEN
)

if (-not $BaseUrl) { throw "Set EXTERNAL_API_BASE_URL or pass -BaseUrl" }
if (-not $Token) { throw "Set EXTERNAL_API_BEARER_TOKEN or pass -Token" }

$BaseUrl = $BaseUrl.TrimEnd('/')
$uri = "$BaseUrl/api/v1/manufacturing"

$raw = & curl.exe -sS -H "Authorization: Bearer $Token" -H "Accept: application/json" $uri
if ($LASTEXITCODE -ne 0) { throw "curl.exe failed with exit $LASTEXITCODE" }

$payload = $raw | ConvertFrom-Json
$rows = $null
if ($null -ne $payload.data) {
  $rows = @($payload.data)
} elseif ($payload -is [Array]) {
  $rows = $payload
} else {
  $rows = @($payload)
}

$started = $rows | Where-Object { $_.status -eq 'started' }
$started | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 6 }

if ($started.Count -eq 0) {
  Write-Host "# No rows with status=started (total rows in response: $($rows.Count))" -ForegroundColor DarkGray
}
