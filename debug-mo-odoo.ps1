# Debug MO - Query Langsung dari Odoo
# Script untuk check MO langsung di Odoo dan auto-fix jika perlu

param(
    [Parameter(Mandatory=$true)]
    [string]$MoNumber = "PROD/MO/29884"
)

$baseUrl = "http://localhost:3000"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Debug MO di Odoo: $MoNumber" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

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

# 1. Query MO langsung dari Odoo
Write-Host "1. Querying MO from Odoo..." -ForegroundColor Yellow
$odooMo = Invoke-ApiCall -Url "$baseUrl/api/odoo/debug/query-mo?moNumber=$MoNumber"

if ($odooMo) {
    if ($odooMo.found) {
        Write-Host "   ✅ MO FOUND in Odoo!" -ForegroundColor Green
        Write-Host ""
        Write-Host "   📋 MO Details:" -ForegroundColor Cyan
        Write-Host "      MO Number: $($odooMo.mo_number)" -ForegroundColor White
        Write-Host "      SKU: $($odooMo.sku_name)" -ForegroundColor White
        Write-Host "      Quantity: $($odooMo.quantity) $($odooMo.uom)" -ForegroundColor White
        Write-Host "      Note: $($odooMo.note)" -ForegroundColor White
        Write-Host "      Create Date: $($odooMo.create_date)" -ForegroundColor White
        Write-Host "      State: $($odooMo.state)" -ForegroundColor White
        Write-Host ""
        
        Write-Host "   📊 Analysis:" -ForegroundColor Cyan
        Write-Host "      Days Old: $($odooMo.analysis.days_old)" -ForegroundColor White
        Write-Host "      Within 30 Days: $($odooMo.analysis.within_30_days)" -ForegroundColor $(if ($odooMo.analysis.within_30_days) { "Green" } else { "Red" })
        Write-Host "      Note Contains 'cartridge': $($odooMo.analysis.note_contains_cartridge)" -ForegroundColor $(if ($odooMo.analysis.note_contains_cartridge) { "Green" } else { "Red" })
        Write-Host "      Would Pass Filter: $($odooMo.analysis.would_pass_filter)" -ForegroundColor $(if ($odooMo.analysis.would_pass_filter) { "Green" } else { "Red" })
        Write-Host ""
        
        if ($odooMo.analysis.would_pass_filter) {
            Write-Host "   ✅ MO SHOULD appear in mo-list!" -ForegroundColor Green
            Write-Host ""
            
            # Check if in cache
            Write-Host "2. Checking if MO is in cache..." -ForegroundColor Yellow
            $cacheCheck = Invoke-ApiCall -Url "$baseUrl/api/odoo/debug/mo-sync?moNumber=$MoNumber"
            
            if ($cacheCheck -and $cacheCheck.moFound) {
                Write-Host "   ✅ MO is in cache!" -ForegroundColor Green
                Write-Host "   Problem might be in frontend filtering or API call" -ForegroundColor Yellow
            } else {
                Write-Host "   ❌ MO NOT in cache!" -ForegroundColor Red
                Write-Host "   Need to sync from Odoo..." -ForegroundColor Yellow
                Write-Host ""
                
                $sync = Read-Host "   Trigger sync now? (y/n)"
                if ($sync -eq 'y' -or $sync -eq 'Y') {
                    Write-Host "   Triggering sync..." -ForegroundColor Yellow
                    $syncResult = Invoke-ApiCall -Url "$baseUrl/api/admin/sync-mo" -Method "POST"
                    
                    if ($syncResult -and $syncResult.success) {
                        Write-Host "   ✅ Sync started!" -ForegroundColor Green
                        Write-Host "   Waiting 45 seconds for sync to complete..." -ForegroundColor Yellow
                        Start-Sleep -Seconds 45
                        
                        Write-Host ""
                        Write-Host "3. Re-checking cache..." -ForegroundColor Yellow
                        $cacheCheckAfter = Invoke-ApiCall -Url "$baseUrl/api/odoo/debug/mo-sync?moNumber=$MoNumber"
                        
                        if ($cacheCheckAfter -and $cacheCheckAfter.moFound) {
                            Write-Host "   ✅ MO NOW in cache!" -ForegroundColor Green
                            Write-Host "   ✅ Problem RESOLVED!" -ForegroundColor Green
                        } else {
                            Write-Host "   ❌ MO still not in cache" -ForegroundColor Red
                            Write-Host "   Check server logs for errors" -ForegroundColor Yellow
                        }
                    }
                }
            }
        } else {
            Write-Host "   ❌ MO will NOT pass filter!" -ForegroundColor Red
            Write-Host ""
            
            if (-not $odooMo.analysis.within_30_days) {
                Write-Host "   ⚠️  ISSUE: MO is older than 30 days ($($odooMo.analysis.days_old) days)" -ForegroundColor Yellow
                Write-Host "   SOLUTION: Increase daysBack in server/index.js from 30 to 60 or more" -ForegroundColor White
            }
            
            if (-not $odooMo.analysis.note_contains_cartridge) {
                Write-Host "   ⚠️  ISSUE: Note doesn't contain 'cartridge'" -ForegroundColor Yellow
                Write-Host "   Current note: '$($odooMo.note)'" -ForegroundColor White
                Write-Host "   SOLUTION: Update note in Odoo to include 'cartridge'" -ForegroundColor White
            }
        }
    } else {
        Write-Host "   ❌ MO NOT FOUND in Odoo!" -ForegroundColor Red
        Write-Host "   Message: $($odooMo.message)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Possible reasons:" -ForegroundColor Yellow
        Write-Host "   1. MO number is incorrect (check spelling/case)" -ForegroundColor White
        Write-Host "   2. MO hasn't been created yet in Odoo" -ForegroundColor White
        Write-Host "   3. Odoo session expired (need to update session_id)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Debug complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "- This script queries MO directly from Odoo (no date filter)" -ForegroundColor White
Write-Host "- Analyzes if MO would pass the 30-day + cartridge filter" -ForegroundColor White
Write-Host "- Auto-syncs if MO should appear but isn't in cache" -ForegroundColor White
Write-Host ""
