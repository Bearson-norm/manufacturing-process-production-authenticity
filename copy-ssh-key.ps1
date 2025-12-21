# Script untuk copy SSH public key ke VPS
# Jalankan: .\copy-ssh-key.ps1

$publicKeyPath = "$env:USERPROFILE\.ssh\github_actions_vps.pub"
$vpsUser = "foom"
$vpsHost = "103.31.39.189"

Write-Host "=== Copy SSH Public Key ke VPS ===" -ForegroundColor Cyan
Write-Host ""

# Baca public key
if (Test-Path $publicKeyPath) {
    $publicKey = Get-Content $publicKeyPath -Raw
    Write-Host "Public Key ditemukan!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Public Key:" -ForegroundColor Yellow
    Write-Host $publicKey
    Write-Host ""
    
    Write-Host "Pilih metode copy:" -ForegroundColor Cyan
    Write-Host "1. Otomatis (menggunakan ssh-copy-id jika tersedia)" -ForegroundColor White
    Write-Host "2. Manual (copy-paste)" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Pilih (1 atau 2)"
    
    if ($choice -eq "1") {
        # Coba copy otomatis
        Write-Host "Mencoba copy otomatis..." -ForegroundColor Yellow
        $publicKeyContent = Get-Content $publicKeyPath
        
        # Gunakan ssh untuk copy key
        $command = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$publicKeyContent' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
        
        Write-Host "Menjalankan command di VPS..." -ForegroundColor Yellow
        Write-Host "Command: $command" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Masukkan password VPS jika diminta:" -ForegroundColor Yellow
        
        ssh "$vpsUser@$vpsHost" $command
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Public key berhasil di-copy ke VPS!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ Gagal copy otomatis. Gunakan metode manual." -ForegroundColor Red
        }
    } else {
        # Manual copy
        Write-Host ""
        Write-Host "=== INSTRUKSI MANUAL ===" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "1. SSH ke VPS:" -ForegroundColor Cyan
        Write-Host "   ssh $vpsUser@$vpsHost" -ForegroundColor White
        Write-Host ""
        Write-Host "2. Di VPS, jalankan command berikut:" -ForegroundColor Cyan
        Write-Host "   mkdir -p ~/.ssh" -ForegroundColor White
        Write-Host "   chmod 700 ~/.ssh" -ForegroundColor White
        Write-Host "   nano ~/.ssh/authorized_keys" -ForegroundColor White
        Write-Host ""
        Write-Host "3. Paste public key berikut ke file authorized_keys:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host $publicKey -ForegroundColor Yellow
        Write-Host ""
        Write-Host "4. Save dan exit (Ctrl+X, Y, Enter)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "5. Set permission:" -ForegroundColor Cyan
        Write-Host "   chmod 600 ~/.ssh/authorized_keys" -ForegroundColor White
        Write-Host ""
        Write-Host "6. Test connection:" -ForegroundColor Cyan
        Write-Host "   ssh -i $env:USERPROFILE\.ssh\github_actions_vps $vpsUser@$vpsHost" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "=== PRIVATE KEY (untuk GitHub Secret) ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Copy private key berikut ke GitHub Secret 'VPS_SSH_KEY':" -ForegroundColor Yellow
    Write-Host ""
    $privateKey = Get-Content "$env:USERPROFILE\.ssh\github_actions_vps" -Raw
    Write-Host $privateKey -ForegroundColor White
    Write-Host ""
    Write-Host "Path file: $env:USERPROFILE\.ssh\github_actions_vps" -ForegroundColor Gray
    
} else {
    Write-Host "❌ Public key tidak ditemukan di: $publicKeyPath" -ForegroundColor Red
}

