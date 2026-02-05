# PowerShell Script untuk Check Resource Usage di VPS
# Usage: .\check-resource-usage.ps1

$SSH_KEY = "C:\Users\info\.ssh\github_actions_vps"
$VPS_USER = "foom"
$VPS_HOST = "103.31.39.189"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "INVESTIGASI KONSUMSI RESOURCE VPS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Function untuk upload script ke VPS
function Upload-Script {
    Write-Host "Uploading check-resource-usage.sh to VPS..." -ForegroundColor Yellow
    
    $scriptContent = Get-Content -Path "check-resource-usage.sh" -Raw -ErrorAction SilentlyContinue
    
    if (-not $scriptContent) {
        Write-Host "Error: check-resource-usage.sh not found in current directory" -ForegroundColor Red
        Write-Host "Please make sure you're in the project root directory" -ForegroundColor Yellow
        return $false
    }
    
    # Create script on VPS using heredoc
    $uploadCommand = @"
cat > /tmp/check-resource-usage.sh << 'SCRIPT_EOF'
$scriptContent
SCRIPT_EOF
chmod +x /tmp/check-resource-usage.sh
"@
    
    ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" $uploadCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Script uploaded successfully!" -ForegroundColor Green
        return $true
    } else {
        Write-Host "Failed to upload script" -ForegroundColor Red
        return $false
    }
}

# Function untuk jalankan quick check
function Quick-Check {
    Write-Host "=== QUICK SYSTEM CHECK ===" -ForegroundColor Blue
    Write-Host ""
    
    $quickCommands = @"
echo '=== DISK USAGE ==='
df -h /
echo ''
echo '=== MEMORY USAGE ==='
free -h
echo ''
echo '=== TOP 10 LARGEST DIRECTORIES ==='
du -h --max-depth=1 /home/foom 2>/dev/null | sort -hr | head -10
echo ''
echo '=== DEPLOYMENTS SIZE ==='
du -sh /home/foom/deployments/* 2>/dev/null | sort -hr
echo ''
echo '=== NODE_MODULES SIZE ==='
find /home/foom -type d -name 'node_modules' -exec du -sh {} \; 2>/dev/null | sort -hr | head -5
echo ''
echo '=== LARGE LOG FILES (>10MB) ==='
find /home/foom -type f -name '*.log' -size +10M -exec ls -lh {} \; 2>/dev/null | head -5
echo ''
echo '=== PM2 STATUS ==='
pm2 status
"@
    
    ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" $quickCommands
}

# Function untuk jalankan full investigation
function Full-Investigation {
    Write-Host "=== RUNNING FULL INVESTIGATION ===" -ForegroundColor Blue
    Write-Host ""
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $logFile = "resource-investigation-$timestamp.log"
    
    Write-Host "Running investigation script on VPS..." -ForegroundColor Yellow
    Write-Host "Results will be saved to: $logFile" -ForegroundColor Yellow
    Write-Host ""
    
    ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "/tmp/check-resource-usage.sh" | Tee-Object -FilePath $logFile
    
    Write-Host ""
    Write-Host "Investigation complete! Results saved to: $logFile" -ForegroundColor Green
    Write-Host "Opening log file..." -ForegroundColor Yellow
    
    Start-Process notepad.exe $logFile
}

# Function untuk cleanup commands
function Show-CleanupCommands {
    Write-Host ""
    Write-Host "=== CLEANUP COMMANDS (Copy-paste ke VPS) ===" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# Clean PM2 logs:" -ForegroundColor Cyan
    Write-Host "pm2 flush" -ForegroundColor White
    Write-Host ""
    Write-Host "# Clean old deployments (keep last 2):" -ForegroundColor Cyan
    Write-Host "cd /home/foom/deployments && ls -t | tail -n +3 | xargs rm -rf" -ForegroundColor White
    Write-Host ""
    Write-Host "# Clean Docker (if not needed):" -ForegroundColor Cyan
    Write-Host "docker system prune -a --volumes" -ForegroundColor White
    Write-Host ""
    Write-Host "# Clean large log files:" -ForegroundColor Cyan
    Write-Host "sudo truncate -s 0 /var/log/nginx/*.log" -ForegroundColor White
    Write-Host ""
}

# Main menu
Write-Host "Select option:" -ForegroundColor Yellow
Write-Host "1. Quick Check (fast, basic info)" -ForegroundColor White
Write-Host "2. Full Investigation (comprehensive, takes longer)" -ForegroundColor White
Write-Host "3. Upload script only" -ForegroundColor White
Write-Host "4. Show cleanup commands" -ForegroundColor White
Write-Host "5. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-5)"

switch ($choice) {
    "1" {
        Quick-Check
    }
    "2" {
        $uploaded = Upload-Script
        if ($uploaded) {
            Full-Investigation
        }
    }
    "3" {
        Upload-Script
    }
    "4" {
        Show-CleanupCommands
    }
    "5" {
        Write-Host "Exiting..." -ForegroundColor Yellow
        exit
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
