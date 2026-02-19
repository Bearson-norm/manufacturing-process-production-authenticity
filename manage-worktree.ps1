# Git Worktree Management Script
# Script helper untuk manage Git worktree dengan mudah

param(
    [Parameter(Position=0)]
    [ValidateSet('list', 'add', 'remove', 'prune', 'status', 'sync', 'help')]
    [string]$Action = 'help',
    
    [Parameter(Position=1)]
    [string]$Argument = ''
)

$WORKTREE_BASE = "$env:USERPROFILE\.cursor\worktrees\Manufacturing-Process-Production-Authenticity"

function Show-Help {
    Write-Host "Git Worktree Management Script" -ForegroundColor Cyan
    Write-Host "==============================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\manage-worktree.ps1 <action> [argument]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Actions:" -ForegroundColor Green
    Write-Host "  list          - List semua worktree yang ada"
    Write-Host "  add <name>    - Tambah worktree baru untuk branch staging"
    Write-Host "  remove <name> - Hapus worktree"
    Write-Host "  prune         - Hapus worktree yang sudah tidak valid"
    Write-Host "  status        - Tampilkan status semua worktree"
    Write-Host "  sync          - Sync semua worktree dengan remote"
    Write-Host "  help          - Tampilkan bantuan ini"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\manage-worktree.ps1 list"
    Write-Host "  .\manage-worktree.ps1 add staging-dev"
    Write-Host "  .\manage-worktree.ps1 remove ybj"
    Write-Host "  .\manage-worktree.ps1 status"
    Write-Host ""
}

function List-Worktrees {
    Write-Host "📋 Daftar Worktree:" -ForegroundColor Cyan
    Write-Host ""
    git worktree list
    Write-Host ""
    
    # Show current worktree
    $currentPath = (Get-Location).Path
    $worktrees = git worktree list --porcelain | Select-String "worktree" | ForEach-Object { $_.Line -replace 'worktree ', '' }
    
    foreach ($wt in $worktrees) {
        if ($currentPath -like "*$wt*") {
            Write-Host "📍 Current worktree: $wt" -ForegroundColor Green
            break
        }
    }
}

function Add-Worktree {
    param([string]$Name)
    
    if ([string]::IsNullOrEmpty($Name)) {
        Write-Host "❌ Error: Nama worktree harus diisi" -ForegroundColor Red
        Write-Host "   Usage: .\manage-worktree.ps1 add <name>" -ForegroundColor Yellow
        return
    }
    
    $worktreePath = Join-Path $WORKTREE_BASE $Name
    
    if (Test-Path $worktreePath) {
        Write-Host "❌ Error: Worktree '$Name' sudah ada di $worktreePath" -ForegroundColor Red
        return
    }
    
    Write-Host "📦 Creating worktree '$Name'..." -ForegroundColor Cyan
    Write-Host "   Path: $worktreePath" -ForegroundColor Gray
    Write-Host "   Branch: staging" -ForegroundColor Gray
    Write-Host ""
    
    try {
        git worktree add $worktreePath staging
        Write-Host "✅ Worktree '$Name' created successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "💡 Next steps:" -ForegroundColor Yellow
        Write-Host "   cd $worktreePath" -ForegroundColor White
    } catch {
        Write-Host "❌ Error creating worktree: $_" -ForegroundColor Red
    }
}

function Remove-Worktree {
    param([string]$Name)
    
    if ([string]::IsNullOrEmpty($Name)) {
        Write-Host "❌ Error: Nama worktree harus diisi" -ForegroundColor Red
        Write-Host "   Usage: .\manage-worktree.ps1 remove <name>" -ForegroundColor Yellow
        return
    }
    
    $worktreePath = Join-Path $WORKTREE_BASE $Name
    
    if (-not (Test-Path $worktreePath)) {
        Write-Host "❌ Error: Worktree '$Name' tidak ditemukan di $worktreePath" -ForegroundColor Red
        return
    }
    
    Write-Host "🗑️  Removing worktree '$Name'..." -ForegroundColor Yellow
    Write-Host "   Path: $worktreePath" -ForegroundColor Gray
    Write-Host ""
    
    # Check for uncommitted changes
    Push-Location $worktreePath
    $status = git status --porcelain
    Pop-Location
    
    if ($status) {
        Write-Host "⚠️  Warning: Ada uncommitted changes di worktree ini!" -ForegroundColor Yellow
        $confirm = Read-Host "   Hapus anyway? (y/N)"
        if ($confirm -ne 'y') {
            Write-Host "   Cancelled." -ForegroundColor Gray
            return
        }
        git worktree remove --force $worktreePath
    } else {
        git worktree remove $worktreePath
    }
    
    Write-Host "✅ Worktree '$Name' removed successfully!" -ForegroundColor Green
}

function Prune-Worktrees {
    Write-Host "🧹 Pruning invalid worktrees..." -ForegroundColor Cyan
    git worktree prune
    Write-Host "✅ Done!" -ForegroundColor Green
}

function Show-Status {
    Write-Host "📊 Status Worktree:" -ForegroundColor Cyan
    Write-Host ""
    
    $worktrees = git worktree list --porcelain
    
    $currentWorktree = ""
    $worktreeList = @()
    
    foreach ($line in $worktrees) {
        if ($line -match "^worktree (.+)$") {
            $currentWorktree = $matches[1]
        } elseif ($line -match "^HEAD (.+)$") {
            $head = $matches[1]
        } elseif ($line -match "^branch (.+)$") {
            $branch = $matches[1] -replace 'refs/heads/', ''
            
            $status = "  "
            if (Test-Path $currentWorktree) {
                Push-Location $currentWorktree
                $gitStatus = git status --porcelain
                $isClean = [string]::IsNullOrEmpty($gitStatus)
                Pop-Location
                
                if ($isClean) {
                    $status = "✅"
                } else {
                    $status = "⚠️ "
                }
            } else {
                $status = "❌"
            }
            
            $worktreeList += [PSCustomObject]@{
                Status = $status
                Path = $currentWorktree
                Branch = $branch
                HEAD = $head
            }
        }
    }
    
    $worktreeList | Format-Table -AutoSize
    
    Write-Host ""
    Write-Host "Legend:" -ForegroundColor Gray
    Write-Host "  ✅ Clean (no uncommitted changes)" -ForegroundColor Green
    Write-Host "  ⚠️  Has uncommitted changes" -ForegroundColor Yellow
    Write-Host "  ❌ Invalid (path not found)" -ForegroundColor Red
}

function Sync-Worktrees {
    Write-Host "🔄 Syncing all worktrees with remote..." -ForegroundColor Cyan
    Write-Host ""
    
    # Fetch first
    Write-Host "📥 Fetching from remote..." -ForegroundColor Cyan
    git fetch origin
    Write-Host ""
    
    # Get all worktrees
    $worktrees = git worktree list --porcelain
    $currentPath = ""
    $currentBranch = ""
    
    foreach ($line in $worktrees) {
        if ($line -match "^worktree (.+)$") {
            if ($currentPath -and $currentBranch) {
                Sync-SingleWorktree $currentPath $currentBranch
            }
            $currentPath = $matches[1]
        } elseif ($line -match "^branch (.+)$") {
            $currentBranch = $matches[1] -replace 'refs/heads/', ''
        }
    }
    
    # Sync last worktree
    if ($currentPath -and $currentBranch) {
        Sync-SingleWorktree $currentPath $currentBranch
    }
    
    Write-Host ""
    Write-Host "✅ All worktrees synced!" -ForegroundColor Green
}

function Sync-SingleWorktree {
    param([string]$Path, [string]$Branch)
    
    if (-not (Test-Path $Path)) {
        Write-Host "❌ Skipping $Path (not found)" -ForegroundColor Red
        return
    }
    
    Write-Host "🔄 Syncing $Branch at $Path..." -ForegroundColor Cyan
    
    Push-Location $Path
    try {
        git pull origin $Branch 2>&1 | Out-Null
        Write-Host "   ✅ $Branch synced" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Error syncing $Branch" -ForegroundColor Yellow
    }
    Pop-Location
}

# Main execution
switch ($Action) {
    'list' {
        List-Worktrees
    }
    'add' {
        Add-Worktree -Name $Argument
    }
    'remove' {
        Remove-Worktree -Name $Argument
    }
    'prune' {
        Prune-Worktrees
    }
    'status' {
        Show-Status
    }
    'sync' {
        Sync-Worktrees
    }
    'help' {
        Show-Help
    }
    default {
        Show-Help
    }
}
