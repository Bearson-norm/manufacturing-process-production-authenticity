# Quick Script untuk Download Database dari VPS
# Usage: powershell -ExecutionPolicy Bypass -File quick-download-database.ps1

$VPS_HOST = "foom@103.31.39.189"
$REMOTE_PATH = "~/deployments/manufacturing-app/server/database.sqlite"
$LOCAL_DIR = "$env:USERPROFILE\Downloads"
$LOCAL_PATH = "$LOCAL_DIR\manufacturing-database.sqlite"
$BACKUP_PATH = "$LOCAL_DIR\manufacturing-database-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').sqlite"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Download Manufacturing Database from VPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if scp is available
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: scp command not found!" -ForegroundColor Red
    Write-Host "Please install OpenSSH Client or use WSL" -ForegroundColor Yellow
    exit 1
}

# Backup existing local database if exists
if (Test-Path $LOCAL_PATH) {
    Write-Host "Backing up existing database..." -ForegroundColor Yellow
    Copy-Item $LOCAL_PATH $BACKUP_PATH
    Write-Host "Backup saved to: $BACKUP_PATH" -ForegroundColor Green
    Write-Host ""
}

# Download database
Write-Host "Downloading database from VPS..." -ForegroundColor Yellow
Write-Host "Host: $VPS_HOST" -ForegroundColor Gray
Write-Host "Remote: $REMOTE_PATH" -ForegroundColor Gray
Write-Host "Local: $LOCAL_PATH" -ForegroundColor Gray
Write-Host ""

$scpCommand = "scp ${VPS_HOST}:${REMOTE_PATH} `"$LOCAL_PATH`""
Write-Host "Executing: $scpCommand" -ForegroundColor Gray
Invoke-Expression $scpCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! Database downloaded" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Database location:" -ForegroundColor Cyan
    Write-Host "  $LOCAL_PATH" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Open DBeaver" -ForegroundColor White
    Write-Host "  2. Create New Database Connection" -ForegroundColor White
    Write-Host "  3. Select SQLite (DO NOT enable SSH Tunnel)" -ForegroundColor White
    Write-Host "  4. Path: $LOCAL_PATH" -ForegroundColor White
    Write-Host "  5. Test Connection" -ForegroundColor White
    Write-Host ""
    
    # Get file info
    $fileInfo = Get-Item $LOCAL_PATH
    $fileSizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "Database info:" -ForegroundColor Cyan
    Write-Host "  Size: $fileSizeMB MB" -ForegroundColor White
    Write-Host "  Modified: $($fileInfo.LastWriteTime)" -ForegroundColor White
    Write-Host ""
    
    # Open containing folder
    $openFolder = Read-Host "Open Downloads folder? (Y/N)"
    if ($openFolder -eq "Y" -or $openFolder -eq "y") {
        explorer.exe /select,"$LOCAL_PATH"
    }
    
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR: Failed to download database" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "  - Wrong password" -ForegroundColor White
    Write-Host "  - VPS not accessible" -ForegroundColor White
    Write-Host "  - Database file not found" -ForegroundColor White
    Write-Host ""
    Write-Host "Try manual download:" -ForegroundColor Cyan
    Write-Host "  scp ${VPS_HOST}:${REMOTE_PATH} `"$LOCAL_PATH`"" -ForegroundColor White
    Write-Host ""
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

