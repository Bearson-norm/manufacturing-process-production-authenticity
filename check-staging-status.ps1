# PowerShell Script untuk Check Staging Status
# File: check-staging-status.ps1

param(
    [string]$VpsHost = "103.31.39.189",
    [string]$VpsUser = "foom",
    [int]$StagingPort = 5678
)

Write-Host "🔍 Checking Staging Deployment Status..." -ForegroundColor Cyan
Write-Host ""

# 1. Check Git Status
Write-Host "1️⃣ Checking Git Status..." -ForegroundColor Yellow
Write-Host "   Current branch:" -NoNewline
git branch --show-current
Write-Host "   Last 3 commits on staging:" -ForegroundColor Gray
git log origin/staging --oneline -3
Write-Host ""

# 2. Check GitHub Actions
Write-Host "2️⃣ GitHub Actions Status:" -ForegroundColor Yellow
Write-Host "   Opening GitHub Actions page..." -ForegroundColor Gray
$repoUrl = git config --get remote.origin.url
if ($repoUrl -match "github.com[:/](.+?)/(.*?)(\.git)?$") {
    $owner = $matches[1]
    $repo = $matches[2]
    $actionsUrl = "https://github.com/$owner/$repo/actions"
    Write-Host "   URL: $actionsUrl" -ForegroundColor Gray
    Write-Host "   💡 Check if latest workflow for 'staging' branch succeeded" -ForegroundColor Cyan
}
Write-Host ""

# 3. Test Staging Health Endpoint
Write-Host "3️⃣ Testing Staging Health Endpoint..." -ForegroundColor Yellow
try {
    $healthUrl = "http://staging.mpr.moof-set.web.id/health"
    Write-Host "   URL: $healthUrl" -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 10 -ErrorAction Stop
    if ($response.status -eq "healthy") {
        Write-Host "   ✅ Status: HEALTHY" -ForegroundColor Green
        Write-Host "   ✅ Database: $($response.database)" -ForegroundColor Green
        Write-Host "   ⏱️  Uptime: $([math]::Round($response.uptime / 60, 2)) minutes" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Status: $($response.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Failed to connect to staging health endpoint" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}
Write-Host ""

# 4. Test Direct IP Access
Write-Host "4️⃣ Testing Direct IP Access..." -ForegroundColor Yellow
try {
    $ipHealthUrl = "http://${VpsHost}:${StagingPort}/health"
    Write-Host "   URL: $ipHealthUrl" -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri $ipHealthUrl -TimeoutSec 10 -ErrorAction Stop
    if ($response.status -eq "healthy") {
        Write-Host "   ✅ Direct IP access: OK" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Response: $($response.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Failed to connect via direct IP" -ForegroundColor Red
    Write-Host "   💡 Port $StagingPort might be closed or firewall blocking" -ForegroundColor Cyan
}
Write-Host ""

# 5. Check if SSH is available
Write-Host "5️⃣ Checking SSH Connectivity..." -ForegroundColor Yellow
$sshCheck = Get-Command ssh -ErrorAction SilentlyContinue
if ($sshCheck) {
    Write-Host "   ✅ SSH command available" -ForegroundColor Green
    Write-Host "   💡 You can SSH to VPS with: ssh ${VpsUser}@${VpsHost}" -ForegroundColor Cyan
} else {
    Write-Host "   ⚠️  SSH command not found" -ForegroundColor Yellow
    Write-Host "   💡 Install OpenSSH client or use PuTTY" -ForegroundColor Cyan
}
Write-Host ""

# 6. Cache Check Reminder
Write-Host "6️⃣ Browser Cache Check:" -ForegroundColor Yellow
Write-Host "   💡 If staging is running but changes not visible:" -ForegroundColor Cyan
Write-Host "      - Hard Reload: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)" -ForegroundColor Gray
Write-Host "      - Test in Incognito/Private window" -ForegroundColor Gray
Write-Host "      - Clear browser cache" -ForegroundColor Gray
Write-Host ""

# 7. Next Steps
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host ""

# Check if we can access staging
try {
    $healthUrl = "http://staging.mpr.moof-set.web.id/health"
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5 -ErrorAction Stop
    if ($response.status -eq "healthy") {
        Write-Host "   ✅ Staging is running and healthy!" -ForegroundColor Green
        Write-Host ""
        Write-Host "   🔧 If changes are not visible:" -ForegroundColor Yellow
        Write-Host "      1. Hard reload browser (Ctrl+Shift+R)" -ForegroundColor Gray
        Write-Host "      2. Test in incognito window" -ForegroundColor Gray
        Write-Host "      3. SSH to VPS and check file timestamps:" -ForegroundColor Gray
        Write-Host "         ssh ${VpsUser}@${VpsHost}" -ForegroundColor DarkGray
        Write-Host "         ls -lt /home/${VpsUser}/deployments/manufacturing-app-staging/client-build/static/js/*.js | head -3" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "   📝 Run this on VPS for detailed troubleshooting:" -ForegroundColor Cyan
        Write-Host "      ./fix-staging-update.sh" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Cannot reach staging endpoint" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   🔧 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "      1. Check GitHub Actions - workflow might have failed" -ForegroundColor Gray
    Write-Host "      2. SSH to VPS and check PM2 status:" -ForegroundColor Gray
    Write-Host "         ssh ${VpsUser}@${VpsHost}" -ForegroundColor DarkGray
    Write-Host "         pm2 status" -ForegroundColor DarkGray
    Write-Host "         pm2 logs manufacturing-app-staging --lines 30" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "      3. Check if server is running on port ${StagingPort}:" -ForegroundColor Gray
    Write-Host "         sudo netstat -tlnp | grep ${StagingPort}" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "      4. Restart staging manually:" -ForegroundColor Gray
    Write-Host "         pm2 restart manufacturing-app-staging" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "📚 Full troubleshooting guide: STAGING_NOT_UPDATING_TROUBLESHOOT.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green
