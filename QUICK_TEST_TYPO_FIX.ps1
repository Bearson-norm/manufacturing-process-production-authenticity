# Quick Test - Typo Fix for CARTIRDGE
# Script untuk test fix typo setelah update code

$baseUrl = "http://localhost:3000"
$moNumber = "PROD/MO/29884"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Typo Fix: CARTIRDGE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

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

# Check if server is running
Write-Host "Checking if server is running..." -ForegroundColor Yellow
try {
    $health = Invoke-ApiCall -Url "$baseUrl/health"
    if ($health.status -eq "healthy") {
        Write-Host "✅ Server is running!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Server is running but not healthy" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Server is NOT running!" -ForegroundColor Red
    Write-Host "   Please start server first: cd server && npm start" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "1. Querying MO from Odoo..." -ForegroundColor Yellow
$odooMo = Invoke-ApiCall -Url "$baseUrl/api/odoo/debug/query-mo?moNumber=$moNumber"

if ($odooMo -and $odooMo.found) {
    Write-Host "   ✅ MO Found!" -ForegroundColor Green
    Write-Host "      MO: $($odooMo.mo_number)" -ForegroundColor Cyan
    Write-Host "      Note: $($odooMo.note)" -ForegroundColor Cyan
    Write-Host "      Has Cartridge (with typo tolerance): $($odooMo.analysis.note_contains_cartridge)" -ForegroundColor $(if ($odooMo.analysis.note_contains_cartridge) { "Green" } else { "Red" })
    Write-Host "      Would Pass Filter: $($odooMo.analysis.would_pass_filter)" -ForegroundColor $(if ($odooMo.analysis.would_pass_filter) { "Green" } else { "Red" })
    Write-Host ""
    
    if ($odooMo.analysis.would_pass_filter) {
        Write-Host "   ✅ MO SHOULD appear in mo-list after sync!" -ForegroundColor Green
        Write-Host ""
        
        # Trigger sync
        Write-Host "2. Triggering sync..." -ForegroundColor Yellow
        $syncResult = Invoke-ApiCall -Url "$baseUrl/api/admin/sync-mo" -Method "POST"
        
        if ($syncResult -and $syncResult.success) {
            Write-Host "   ✅ Sync started!" -ForegroundColor Green
            Write-Host "   ⏳ Waiting 45 seconds for sync to complete..." -ForegroundColor Yellow
            
            # Progress bar
            for ($i = 1; $i -le 45; $i++) {
                Write-Progress -Activity "Syncing MO data from Odoo" -Status "$i/45 seconds" -PercentComplete (($i / 45) * 100)
                Start-Sleep -Seconds 1
            }
            Write-Progress -Activity "Syncing MO data from Odoo" -Completed
            
            Write-Host ""
            Write-Host "3. Checking if MO is now in cache..." -ForegroundColor Yellow
            $cacheCheck = Invoke-ApiCall -Url "$baseUrl/api/odoo/debug/mo-sync?moNumber=$moNumber"
            
            if ($cacheCheck -and $cacheCheck.moFound) {
                Write-Host "   ✅ MO is NOW in cache!" -ForegroundColor Green
                Write-Host "      Fetched at: $($cacheCheck.moData.fetched_at)" -ForegroundColor Cyan
                Write-Host ""
                
                Write-Host "4. Checking mo-list..." -ForegroundColor Yellow
                $moList = Invoke-ApiCall -Url "$baseUrl/api/odoo/mo-list?productionType=cartridge"
                
                if ($moList -and $moList.data) {
                    $foundInList = $moList.data | Where-Object { $_.mo_number -eq $moNumber }
                    
                    if ($foundInList) {
                        Write-Host "   ✅✅✅ SUCCESS! MO FOUND in mo-list!" -ForegroundColor Green
                        Write-Host ""
                        Write-Host "   MO Details:" -ForegroundColor Cyan
                        Write-Host "      MO Number: $($foundInList.mo_number)" -ForegroundColor White
                        Write-Host "      SKU: $($foundInList.sku_name)" -ForegroundColor White
                        Write-Host "      Quantity: $($foundInList.quantity) $($foundInList.uom)" -ForegroundColor White
                        Write-Host "      Note: $($foundInList.note)" -ForegroundColor White
                        Write-Host "      Create Date: $($foundInList.create_date)" -ForegroundColor White
                        Write-Host ""
                        Write-Host "   🎉 TYPO FIX WORKING! Problem RESOLVED!" -ForegroundColor Green
                    } else {
                        Write-Host "   ❌ MO NOT found in mo-list" -ForegroundColor Red
                        Write-Host "   Total MOs in list: $($moList.count)" -ForegroundColor Yellow
                        Write-Host "   This is unexpected. Check server logs for errors." -ForegroundColor Yellow
                    }
                }
            } else {
                Write-Host "   ❌ MO still NOT in cache" -ForegroundColor Red
                Write-Host "   Check server logs for sync errors" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   ❌ Failed to trigger sync" -ForegroundColor Red
        }
    } else {
        Write-Host "   ❌ MO would NOT pass filter!" -ForegroundColor Red
        Write-Host ""
        
        if (-not $odooMo.analysis.note_contains_cartridge) {
            Write-Host "   ⚠️  ISSUE: Note doesn't contain cartridge (even with typo tolerance)" -ForegroundColor Yellow
            Write-Host "   Note: '$($odooMo.note)'" -ForegroundColor White
            Write-Host ""
            Write-Host "   Supported variations:" -ForegroundColor Yellow
            Write-Host "   - cartridge (correct)" -ForegroundColor White
            Write-Host "   - cartirdge (typo)" -ForegroundColor White
            Write-Host "   - cartrige (typo)" -ForegroundColor White
            Write-Host ""
            Write-Host "   Current note doesn't match any of these patterns." -ForegroundColor Yellow
        }
        
        if (-not $odooMo.analysis.within_30_days) {
            Write-Host "   ⚠️  ISSUE: MO is older than 30 days" -ForegroundColor Yellow
            Write-Host "   Days old: $($odooMo.analysis.days_old)" -ForegroundColor White
        }
    }
} else {
    Write-Host "   ❌ MO NOT found in Odoo" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary of Changes:" -ForegroundColor Yellow
Write-Host "- Filter now accepts: cartridge, cartirdge, cartrige" -ForegroundColor White
Write-Host "- Typo 'CARTIRDGE' is now supported" -ForegroundColor White
Write-Host "- MO PROD/MO/29884 should now appear in mo-list" -ForegroundColor White
Write-Host ""
