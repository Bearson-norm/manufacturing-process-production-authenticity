# Fix Detached HEAD Worktrees
# Script untuk memperbaiki worktree yang dalam keadaan detached HEAD

Write-Host "🔧 Fix Detached HEAD Worktrees" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Get all worktrees
$worktrees = git worktree list --porcelain

$currentPath = ""
$currentBranch = ""
$currentHEAD = ""
$detachedWorktrees = @()

foreach ($line in $worktrees) {
    if ($line -match "^worktree (.+)$") {
        if ($currentPath -and $currentHEAD -match "^[a-f0-9]+$") {
            # Previous worktree was detached
            $detachedWorktrees += [PSCustomObject]@{
                Path = $currentPath
                HEAD = $currentHEAD
                Branch = $currentBranch
            }
        }
        $currentPath = $matches[1]
        $currentBranch = ""
        $currentHEAD = ""
    } elseif ($line -match "^HEAD (.+)$") {
        $currentHEAD = $matches[1]
    } elseif ($line -match "^branch (.+)$") {
        $currentBranch = $matches[1] -replace 'refs/heads/', ''
    }
}

# Check last worktree
if ($currentPath -and $currentHEAD -match "^[a-f0-9]+$") {
    $detachedWorktrees += [PSCustomObject]@{
        Path = $currentPath
        HEAD = $currentHEAD
        Branch = $currentBranch
    }
}

if ($detachedWorktrees.Count -eq 0) {
    Write-Host "✅ Tidak ada worktree dengan detached HEAD!" -ForegroundColor Green
    exit 0
}

Write-Host "⚠️  Ditemukan $($detachedWorktrees.Count) worktree dengan detached HEAD:" -ForegroundColor Yellow
Write-Host ""

foreach ($wt in $detachedWorktrees) {
    Write-Host "  📁 $($wt.Path)" -ForegroundColor White
    Write-Host "     HEAD: $($wt.HEAD)" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Pilih aksi untuk setiap worktree:" -ForegroundColor Cyan
Write-Host "  1. Checkout ke branch staging" -ForegroundColor Yellow
Write-Host "  2. Checkout ke branch main" -ForegroundColor Yellow
Write-Host "  3. Checkout ke branch KMI" -ForegroundColor Yellow
Write-Host "  4. Hapus worktree" -ForegroundColor Yellow
Write-Host "  5. Skip (biarkan seperti ini)" -ForegroundColor Yellow
Write-Host ""

foreach ($wt in $detachedWorktrees) {
    $wtName = Split-Path $wt.Path -Leaf
    Write-Host "Worktree: $wtName" -ForegroundColor Cyan
    Write-Host "  Path: $($wt.Path)" -ForegroundColor Gray
    
    $choice = Read-Host "  Pilih aksi (1-5)"
    
    switch ($choice) {
        '1' {
            Write-Host "  🔄 Checking out to staging..." -ForegroundColor Cyan
            Push-Location $wt.Path
            try {
                git checkout staging 2>&1 | Out-Null
                Write-Host "  ✅ Checked out to staging" -ForegroundColor Green
            } catch {
                Write-Host "  ❌ Error: $_" -ForegroundColor Red
            }
            Pop-Location
        }
        '2' {
            Write-Host "  🔄 Checking out to main..." -ForegroundColor Cyan
            Push-Location $wt.Path
            try {
                git checkout main 2>&1 | Out-Null
                Write-Host "  ✅ Checked out to main" -ForegroundColor Green
            } catch {
                Write-Host "  ❌ Error: $_" -ForegroundColor Red
            }
            Pop-Location
        }
        '3' {
            Write-Host "  🔄 Checking out to KMI..." -ForegroundColor Cyan
            Push-Location $wt.Path
            try {
                git checkout KMI 2>&1 | Out-Null
                Write-Host "  ✅ Checked out to KMI" -ForegroundColor Green
            } catch {
                Write-Host "  ❌ Error: $_" -ForegroundColor Red
            }
            Pop-Location
        }
        '4' {
            Write-Host "  🗑️  Removing worktree..." -ForegroundColor Yellow
            $confirm = Read-Host "  Yakin hapus? (y/N)"
            if ($confirm -eq 'y') {
                try {
                    git worktree remove --force $wt.Path 2>&1 | Out-Null
                    Write-Host "  ✅ Worktree removed" -ForegroundColor Green
                } catch {
                    Write-Host "  ❌ Error: $_" -ForegroundColor Red
                }
            } else {
                Write-Host "  ⏭️  Skipped" -ForegroundColor Gray
            }
        }
        '5' {
            Write-Host "  ⏭️  Skipped" -ForegroundColor Gray
        }
        default {
            Write-Host "  ⏭️  Invalid choice, skipped" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

Write-Host "✅ Done!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Current worktree status:" -ForegroundColor Cyan
git worktree list
