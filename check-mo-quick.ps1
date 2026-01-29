# Quick Check - Simplified Version
param(
    [string]$MoNumber = "PROD/MO/29884"
)

$baseUrl = "http://localhost:3000"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Quick MO Check: $MoNumber" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    # 1. Check MO in Odoo
    Write-Host "1. Checking MO in Odoo..." -ForegroundColor Yellow
    $odooUrl = $baseUrl + "/api/odoo/debug/query-mo?moNumber=" + $MoNumber
    $odooMo = Invoke-RestMethod -Uri $odooUrl -Method GET
    
    if ($odooMo.found) {
        Write-Host "   ✅ Found in Odoo!" -ForegroundColor Green
        Write-Host "      SKU: $($odooMo.sku_name)" -ForegroundColor Cyan
        Write-Host "      Note: $($odooMo.note)" -ForegroundColor Cyan
        Write-Host "      Would Pass Filter: $($odooMo.analysis.would_pass_filter)" -ForegroundColor $(if ($odooMo.analysis.would_pass_filter) { "Green" } else { "Red" })
        
        # Detect type
        $noteText = $odooMo.note.ToLower()
        $productionType = "liquid"
        if ($noteText -match "cartridge|cartirdge|cartrige") {
            $productionType = "cartridge"
        } elseif ($noteText -match "device") {
            $productionType = "device"
        }
        
        Write-Host ""
        Write-Host "   📋 Production Type: $productionType" -ForegroundColor Magenta
        Write-Host ""
        
        # 2. Check if used
        Write-Host "2. Checking if MO has been used..." -ForegroundColor Yellow
        
        $checkUrl = $baseUrl + "/api/production/check-mo-used?moNumber=" + $MoNumber + "&productionType=" + $productionType
        $usage = Invoke-RestMethod -Uri $checkUrl -Method GET
        
        if ($usage.used) {
            Write-Host "   ⚠️  MO HAS BEEN USED!" -ForegroundColor Yellow
            Write-Host "      Total uses: $($usage.count)" -ForegroundColor White
            Write-Host "      Active: $($usage.activeCount)" -ForegroundColor $(if ($usage.activeCount -gt 0) { "Red" } else { "Gray" })
            Write-Host "      Completed: $($usage.completedCount)" -ForegroundColor $(if ($usage.completedCount -gt 0) { "Green" } else { "Gray" })
            Write-Host ""
            Write-Host "   ❌ This is why MO is NOT in dropdown!" -ForegroundColor Red
            Write-Host "      Frontend filters out used MOs to prevent duplicates." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   💡 Solutions:" -ForegroundColor Cyan
            Write-Host "      1. This is EXPECTED behavior (MO should only be input once)" -ForegroundColor White
            Write-Host "      2. Modify frontend to allow completed MOs (see CHECK_MO_USAGE.md)" -ForegroundColor White
        } else {
            Write-Host "   ✅ MO has NOT been used yet!" -ForegroundColor Green
            Write-Host ""
            Write-Host "   🔍 Other possible issues:" -ForegroundColor Yellow
            Write-Host "      1. Type mismatch - Make sure you open Production$($productionType.Substring(0,1).ToUpper() + $productionType.Substring(1)) form" -ForegroundColor White
            Write-Host "      2. Frontend cache - Try hard refresh (Ctrl+Shift+R)" -ForegroundColor White
            Write-Host "      3. Check browser console for errors" -ForegroundColor White
        }
        
        # 3. Check in mo-list
        Write-Host ""
        Write-Host "3. Checking mo-list API..." -ForegroundColor Yellow
        $moListUrl = $baseUrl + "/api/odoo/mo-list?productionType=" + $productionType
        $moList = Invoke-RestMethod -Uri $moListUrl -Method GET
        
        if ($moList.success) {
            $foundInList = $moList.data | Where-Object { $_.mo_number -eq $MoNumber }
            if ($foundInList) {
                Write-Host "   ✅ MO IS in mo-list API!" -ForegroundColor Green
            } else {
                Write-Host "   ❌ MO NOT in mo-list API!" -ForegroundColor Red
                Write-Host "      Need to trigger sync again" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ❌ MO NOT found in Odoo!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure server is running on $baseUrl" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Check Complete!" -ForegroundColor Cyan
Write-Host ""
