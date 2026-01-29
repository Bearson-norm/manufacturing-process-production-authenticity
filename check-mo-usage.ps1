# Quick Check - Apakah MO Sudah Pernah Di-Input
param(
    [string]$MoNumber = "PROD/MO/29884"
)

$baseUrl = "http://localhost:3000"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Check MO Usage: $MoNumber" -ForegroundColor Cyan
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

# 1. Query MO dari Odoo untuk tau type-nya
Write-Host "1. Checking MO details from Odoo..." -ForegroundColor Yellow
$odooMo = Invoke-ApiCall -Url "$baseUrl/api/odoo/debug/query-mo?moNumber=$MoNumber"

if ($odooMo -and $odooMo.found) {
    Write-Host "   ✅ MO Found in Odoo!" -ForegroundColor Green
    Write-Host "      MO: $($odooMo.mo_number)" -ForegroundColor Cyan
    Write-Host "      SKU: $($odooMo.sku_name)" -ForegroundColor Cyan
    Write-Host "      Note: $($odooMo.note)" -ForegroundColor Cyan
    Write-Host ""
    
    # Detect production type
    $noteText = $odooMo.note.ToLower()
    $productionType = "unknown"
    if ($noteText -match "cartridge|cartirdge|cartrige") {
        $productionType = "cartridge"
        Write-Host "   📋 Detected Type: CARTRIDGE" -ForegroundColor Magenta
    } elseif ($noteText -match "liquid") {
        $productionType = "liquid"
        Write-Host "   📋 Detected Type: LIQUID" -ForegroundColor Magenta
    } elseif ($noteText -match "device") {
        $productionType = "device"
        Write-Host "   📋 Detected Type: DEVICE" -ForegroundColor Magenta
    }
    Write-Host ""
    
    # 2. Check if MO has been used
    Write-Host "2. Checking if MO has been used in production..." -ForegroundColor Yellow
    
    $types = @("liquid", "cartridge", "device")
    $foundInAny = $false
    
    foreach ($type in $types) {
        $url = "$baseUrl/api/production/check-mo-used?moNumber=$MoNumber&productionType=$type"
        $usage = Invoke-ApiCall -Url $url
        
        if ($usage -and $usage.used) {
            $foundInAny = $true
            Write-Host ""
            Write-Host "   ⚠️  MO FOUND in '$type' production!" -ForegroundColor Yellow
            Write-Host "      Total uses: $($usage.count)" -ForegroundColor White
            Write-Host "      Active: $($usage.activeCount)" -ForegroundColor $(if ($usage.activeCount -gt 0) { "Red" } else { "Gray" })
            Write-Host "      Completed: $($usage.completedCount)" -ForegroundColor $(if ($usage.completedCount -gt 0) { "Green" } else { "Gray" })
            Write-Host ""
            Write-Host "      Recent records:" -ForegroundColor Cyan
            $usage.records | Select-Object -First 3 | ForEach-Object {
                Write-Host "      - Session: $($_.session_id), Status: $($_.status), Created: $($_.created_at)" -ForegroundColor White
            }
        }
    }
    
    if (-not $foundInAny) {
        Write-Host "   ✅ MO has NOT been used yet!" -ForegroundColor Green
        Write-Host "   Should appear in dropdown if type matches." -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "DIAGNOSIS" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($foundInAny) {
        Write-Host "🔍 Why MO is not in dropdown:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Frontend filters out MOs that have been used to prevent duplicates." -ForegroundColor White
        Write-Host ""
        Write-Host "   Current filter logic:" -ForegroundColor Cyan
        Write-Host "   - If MO has ANY input (active or completed) → Hidden from dropdown" -ForegroundColor White
        Write-Host ""
        Write-Host "✅ SOLUTIONS:" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Option 1: This is EXPECTED BEHAVIOR" -ForegroundColor Yellow
        Write-Host "   - MO should only be input once" -ForegroundColor White
        Write-Host "   - If you need to input again, it should be a NEW MO number" -ForegroundColor White
        Write-Host ""
        Write-Host "   Option 2: Modify Frontend Filter" -ForegroundColor Yellow
        Write-Host "   - Edit: client/src/components/Production$($productionType.Substring(0,1).ToUpper() + $productionType.Substring(1)).js" -ForegroundColor White
        Write-Host "   - Change filter to only exclude ACTIVE MOs" -ForegroundColor White
        Write-Host "   - Allow COMPLETED MOs to be input again" -ForegroundColor White
        Write-Host ""
        Write-Host "   Option 3: Archive Old Data" -ForegroundColor Yellow
        Write-Host "   - Update old records status to 'archived'" -ForegroundColor White
        Write-Host "   - Then MO will appear in dropdown again" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "🔍 Possible issues:" -ForegroundColor Yellow
        Write-Host ""
        
        if ($productionType -ne "unknown") {
            Write-Host "   ⚠️  Type Mismatch Check:" -ForegroundColor Yellow
            Write-Host "   - MO is for: $productionType" -ForegroundColor White
            Write-Host "   - Make sure you're opening Production$($productionType.Substring(0,1).ToUpper() + $productionType.Substring(1)) form" -ForegroundColor White
            Write-Host "   - NOT ProductionLiquid if this is cartridge!" -ForegroundColor Red
            Write-Host ""
        }
        
        Write-Host "   Other possible causes:" -ForegroundColor Yellow
        Write-Host "   1. Frontend cache - Try hard refresh (Ctrl+Shift+R)" -ForegroundColor White
        Write-Host "   2. Frontend not fetching latest data - Check browser console" -ForegroundColor White
        Write-Host "   3. Filter by SKU (MIXING excluded) - Check if SKU is MIXING" -ForegroundColor White
        Write-Host ""
    }
    
    # 3. Check in mo-list
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "VERIFICATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($productionType -ne "unknown") {
        Write-Host "Checking mo-list API for $productionType..." -ForegroundColor Yellow
        $moListUrl = "$baseUrl/api/odoo/mo-list?productionType=$productionType"
        $moList = Invoke-ApiCall -Url $moListUrl
        
        if ($moList -and $moList.data) {
            $foundInList = $moList.data | Where-Object { $_.mo_number -eq $MoNumber }
            
            if ($foundInList) {
                Write-Host "   ✅ MO IS in mo-list API!" -ForegroundColor Green
                Write-Host "   If not showing in dropdown → Frontend filter issue" -ForegroundColor Yellow
            } else {
                Write-Host "   ❌ MO NOT in mo-list API!" -ForegroundColor Red
                Write-Host "   Need to sync again or check filters" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "   ❌ MO NOT found in Odoo" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Check Complete!" -ForegroundColor Cyan
Write-Host ""
