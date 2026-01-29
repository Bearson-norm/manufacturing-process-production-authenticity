# Simple MO Check - No Ampersand Issues
param(
    [string]$MoNumber = "PROD/MO/29884"
)

$baseUrl = "http://localhost:3000"

Write-Host "========================================"
Write-Host "  Quick MO Check: $MoNumber"
Write-Host "========================================"
Write-Host ""

try {
    # 1. Check MO in Odoo
    Write-Host "1. Checking MO in Odoo..."
    $odooResponse = Invoke-RestMethod -Uri "$baseUrl/api/odoo/debug/query-mo" -Method GET -Body @{moNumber=$MoNumber}
    
    if ($odooResponse.found) {
        Write-Host "   [OK] Found in Odoo!"
        Write-Host "      SKU: $($odooResponse.sku_name)"
        Write-Host "      Note: $($odooResponse.note)"
        Write-Host "      Would Pass Filter: $($odooResponse.analysis.would_pass_filter)"
        
        # Detect type
        $noteText = $odooResponse.note.ToLower()
        $productionType = "liquid"
        if ($noteText -match "cartridge|cartirdge|cartrige") {
            $productionType = "cartridge"
        } elseif ($noteText -match "device") {
            $productionType = "device"
        }
        
        Write-Host ""
        Write-Host "   Production Type: $productionType"
        Write-Host ""
        
        # 2. Check if used
        Write-Host "2. Checking if MO has been used..."
        $checkParams = @{
            moNumber = $MoNumber
            productionType = $productionType
        }
        $usageResponse = Invoke-RestMethod -Uri "$baseUrl/api/production/check-mo-used" -Method GET -Body $checkParams
        
        if ($usageResponse.used) {
            Write-Host "   [WARNING] MO HAS BEEN USED!"
            Write-Host "      Total uses: $($usageResponse.count)"
            Write-Host "      Active: $($usageResponse.activeCount)"
            Write-Host "      Completed: $($usageResponse.completedCount)"
            Write-Host ""
            Write-Host "   [X] This is why MO is NOT in dropdown!"
            Write-Host "      Frontend filters out used MOs to prevent duplicates."
            Write-Host ""
            Write-Host "   Solutions:"
            Write-Host "      1. This is EXPECTED behavior (MO should only be input once)"
            Write-Host "      2. Modify frontend to allow completed MOs (see CHECK_MO_USAGE.md)"
            Write-Host ""
            Write-Host "   Recent usage:"
            $usageResponse.records | Select-Object -First 3 | ForEach-Object {
                Write-Host "      - Status: $($_.status), Created: $($_.created_at)"
            }
        } else {
            Write-Host "   [OK] MO has NOT been used yet!"
            Write-Host ""
            Write-Host "   Possible issues:"
            Write-Host "      1. Type mismatch - Make sure you open the correct form"
            Write-Host "         Expected form: Production" -NoNewline
            Write-Host ($productionType.Substring(0,1).ToUpper() + $productionType.Substring(1))
            Write-Host "      2. Frontend cache - Try hard refresh (Ctrl+Shift+R)"
            Write-Host "      3. Check browser console for errors"
        }
        
        # 3. Check in mo-list
        Write-Host ""
        Write-Host "3. Checking mo-list API..."
        $moListParams = @{productionType = $productionType}
        $moListResponse = Invoke-RestMethod -Uri "$baseUrl/api/odoo/mo-list" -Method GET -Body $moListParams
        
        if ($moListResponse.success) {
            $foundInList = $moListResponse.data | Where-Object { $_.mo_number -eq $MoNumber }
            if ($foundInList) {
                Write-Host "   [OK] MO IS in mo-list API!"
            } else {
                Write-Host "   [X] MO NOT in mo-list API!"
                Write-Host "      Need to trigger sync again"
            }
        }
    } else {
        Write-Host "   [X] MO NOT found in Odoo!"
    }
    
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Make sure:"
    Write-Host "  1. Server is running on $baseUrl"
    Write-Host "  2. Endpoint /api/odoo/debug/query-mo exists"
}

Write-Host ""
Write-Host "========================================"
Write-Host "Check Complete!"
Write-Host "========================================"
Write-Host ""
