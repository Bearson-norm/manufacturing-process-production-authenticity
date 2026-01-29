# Debug MO Sync Issue
# Script untuk debugging masalah MO tidak muncul

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Debug MO Sync - PROD/MO/29884" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"
$moNumber = "PROD/MO/29884"

# Function to make API calls
function Invoke-ApiCall {
    param (
        [string]$Url,
        [string]$Method = "GET"
    )
    try {
        $response = Invoke-RestMethod -Uri $Url -Method $Method -ContentType "application/json"
        return $response
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        return $null
    }
}

# 1. Check sync status
Write-Host "1. Checking sync status..." -ForegroundColor Yellow
$syncStatus = Invoke-ApiCall -Url "$baseUrl/api/odoo/debug/mo-sync"
if ($syncStatus) {
    Write-Host "   Last Sync: $($syncStatus.lastSync)" -ForegroundColor Green
    Write-Host "   Hours Since Sync: $($syncStatus.hoursSinceLastSync)" -ForegroundColor Green
    Write-Host "   Sync Status: $($syncStatus.syncStatus)" -ForegroundColor Green
    Write-Host "   Total MOs in Cache: $($syncStatus.totalMosInCache)" -ForegroundColor Green
    
    if ($syncStatus.mosByType) {
        Write-Host "   MOs by Type:" -ForegroundColor Green
        $syncStatus.mosByType | ForEach-Object {
            Write-Host "     - $($_.production_type): $($_.count)" -ForegroundColor Cyan
        }
    }
}
Write-Host ""

# 2. Check specific MO
Write-Host "2. Checking for MO: $moNumber..." -ForegroundColor Yellow
$moCheck = Invoke-ApiCall -Url "$baseUrl/api/odoo/debug/mo-sync?moNumber=$moNumber"
if ($moCheck) {
    if ($moCheck.moFound) {
        Write-Host "   ✅ MO FOUND in cache!" -ForegroundColor Green
        Write-Host "   Details:" -ForegroundColor Green
        Write-Host "     - MO Number: $($moCheck.moData.mo_number)" -ForegroundColor Cyan
        Write-Host "     - SKU: $($moCheck.moData.sku_name)" -ForegroundColor Cyan
        Write-Host "     - Note: $($moCheck.moData.note)" -ForegroundColor Cyan
        Write-Host "     - Created: $($moCheck.moData.create_date)" -ForegroundColor Cyan
        Write-Host "     - Fetched: $($moCheck.moData.fetched_at)" -ForegroundColor Cyan
    } else {
        Write-Host "   ❌ MO NOT FOUND in cache!" -ForegroundColor Red
        Write-Host "   $($moCheck.message)" -ForegroundColor Yellow
    }
}
Write-Host ""

# 3. Ask if user wants to trigger manual sync
Write-Host "3. Manual Sync Options" -ForegroundColor Yellow
$trigger = Read-Host "Do you want to trigger manual sync? (y/n)"
if ($trigger -eq 'y' -or $trigger -eq 'Y') {
    Write-Host "   Triggering manual sync..." -ForegroundColor Yellow
    $syncResult = Invoke-ApiCall -Url "$baseUrl/api/admin/sync-mo" -Method "POST"
    if ($syncResult) {
        Write-Host "   ✅ Sync started!" -ForegroundColor Green
        Write-Host "   Message: $($syncResult.message)" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Please wait 30-60 seconds for sync to complete..." -ForegroundColor Yellow
        
        # Wait and check again
        $wait = Read-Host "Wait and check again? (y/n)"
        if ($wait -eq 'y' -or $wait -eq 'Y') {
            Write-Host "   Waiting 45 seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds 45
            
            Write-Host ""
            Write-Host "4. Re-checking MO after sync..." -ForegroundColor Yellow
            $moCheckAfter = Invoke-ApiCall -Url "$baseUrl/api/odoo/debug/mo-sync?moNumber=$moNumber"
            if ($moCheckAfter) {
                if ($moCheckAfter.moFound) {
                    Write-Host "   ✅ MO NOW FOUND in cache!" -ForegroundColor Green
                    Write-Host "   Problem RESOLVED!" -ForegroundColor Green
                } else {
                    Write-Host "   ❌ MO still NOT FOUND in cache" -ForegroundColor Red
                    Write-Host ""
                    Write-Host "   Possible reasons:" -ForegroundColor Yellow
                    Write-Host "   1. MO doesn't exist in Odoo" -ForegroundColor White
                    Write-Host "   2. MO note doesn't contain 'cartridge'" -ForegroundColor White
                    Write-Host "   3. MO create_date is older than 7 days" -ForegroundColor White
                    Write-Host "   4. Odoo session expired (check admin config)" -ForegroundColor White
                }
            }
        }
    }
} else {
    Write-Host "   Skipped manual sync" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Debug complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "For database-level debugging, run:" -ForegroundColor Yellow
Write-Host "  cd server && node debug-mo-sync.js" -ForegroundColor White
Write-Host ""
Write-Host "To check MO list API:" -ForegroundColor Yellow
Write-Host "  curl ""http://localhost:3000/api/odoo/mo-list?productionType=cartridge""" -ForegroundColor White
Write-Host ""
