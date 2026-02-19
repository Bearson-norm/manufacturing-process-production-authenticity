# Panduan Manage Git Worktree

Panduan lengkap untuk mengelola Git worktree di project Manufacturing Process Production Authenticity.

## Daftar Isi

1. [Melihat Worktree yang Ada](#melihat-worktree-yang-ada)
2. [Membuat Worktree Baru](#membuat-worktree-baru)
3. [Menghapus Worktree](#menghapus-worktree)
4. [Pindah ke Worktree Lain](#pindah-ke-worktree-lain)
5. [Update Worktree](#update-worktree)
6. [Troubleshooting](#troubleshooting)

## Melihat Worktree yang Ada

### Command Dasar
```powershell
# Lihat semua worktree
git worktree list

# Lihat dengan detail lebih lengkap
git worktree list --verbose
```

### Output Contoh
```
C:/Users/info/.cursor/worktrees/Manufacturing-Process-Production-Authenticity/boa    abc1234 [main]
C:/Users/info/.cursor/worktrees/Manufacturing-Process-Production-Authenticity/ybj    def5678 [staging]
C:/Users/info/.cursor/worktrees/Manufacturing-Process-Production-Authenticity/gyl    ghi9012 [KMI]
```

**Penjelasan:**
- Path: Lokasi worktree
- Hash: Commit hash yang sedang di-checkout
- Branch: Nama branch yang sedang aktif

## Membuat Worktree Baru

### 1. Buat Worktree untuk Branch yang Sudah Ada

```powershell
# Buat worktree baru untuk branch staging
git worktree add ../staging-worktree staging

# Buat worktree baru untuk branch KMI
git worktree add ../kmi-worktree KMI

# Buat worktree dengan path custom
git worktree add C:/path/to/new-worktree branch-name
```

### 2. Buat Worktree dengan Branch Baru

```powershell
# Buat worktree baru dan branch baru sekaligus
git worktree add -b new-feature ../new-feature-worktree

# Buat worktree dengan branch baru dari branch tertentu
git worktree add -b feature-xyz ../feature-xyz-worktree staging
```

### 3. Buat Worktree di Lokasi Spesifik

```powershell
# Buat di folder worktrees (seperti yang sudah ada)
git worktree add C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\new-name staging
```

## Menghapus Worktree

### 1. Hapus Worktree (Safe)

```powershell
# Hapus worktree (akan memverifikasi tidak ada uncommitted changes)
git worktree remove <path-to-worktree>

# Contoh
git worktree remove C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\ybj
```

### 2. Hapus Worktree (Force - Hati-hati!)

```powershell
# Hapus worktree meskipun ada uncommitted changes
git worktree remove --force <path-to-worktree>

# Contoh
git worktree remove --force ../staging-worktree
```

### 3. Hapus Worktree yang Sudah Tidak Ada (Cleanup)

```powershell
# Hapus worktree dari registry jika folder sudah dihapus manual
git worktree prune
```

## Pindah ke Worktree Lain

### 1. Pindah dengan cd

```powershell
# Pindah ke worktree staging
cd C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\ybj

# Pindah ke worktree KMI
cd C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\gyl
```

### 2. Checkout Branch di Worktree yang Sama

```powershell
# Di worktree yang sama, pindah ke branch lain
git checkout staging
git checkout main
git checkout KMI
```

## Update Worktree

### 1. Update dari Remote

```powershell
# Di worktree manapun, update dari remote
git fetch origin

# Pull perubahan terbaru
git pull origin staging

# Atau pull dari branch yang sedang aktif
git pull
```

### 2. Sync Semua Worktree

```powershell
# Di setiap worktree, jalankan:
git fetch origin
git pull origin <branch-name>
```

## Best Practices

### 1. Struktur Worktree yang Disarankan

```
Main Worktree (boa):
  - Branch: main
  - Purpose: Production code review

Staging Worktree (ybj):
  - Branch: staging
  - Purpose: Staging environment development

KMI Worktree (gyl):
  - Branch: KMI
  - Purpose: KMI feature development

Feature Worktree (optional):
  - Branch: feature-xyz
  - Purpose: New feature development
```

### 2. Naming Convention

- Gunakan nama yang jelas: `staging`, `kmi`, `feature-xyz`
- Konsisten dengan branch name jika memungkinkan
- Hindari nama yang membingungkan

### 3. Workflow

1. **Development:**
   - Bekerja di worktree sesuai environment
   - Commit perubahan di worktree tersebut
   - Push ke branch yang sesuai

2. **Testing:**
   - Test di worktree staging
   - Jika OK, merge ke main

3. **Cleanup:**
   - Hapus worktree yang tidak digunakan lagi
   - Jangan biarkan worktree menumpuk

## Troubleshooting

### Masalah: Worktree tidak muncul di list

**Solusi:**
```powershell
# Prune worktree yang sudah tidak valid
git worktree prune

# Lihat lagi
git worktree list
```

### Masalah: Error "worktree is locked"

**Solusi:**
```powershell
# Hapus file lock manual
Remove-Item <worktree-path>\.git\index.lock

# Atau unlock worktree
git worktree unlock <worktree-path>
```

### Masalah: Worktree path sudah dihapus manual

**Solusi:**
```powershell
# Prune worktree dari registry
git worktree prune

# Atau hapus dengan force
git worktree remove --force <worktree-path>
```

### Masalah: Branch sudah di-checkout di worktree lain

**Solusi:**
```powershell
# Checkout branch di worktree yang berbeda
# Git akan memberi warning, tapi bisa di-bypass dengan:
git checkout -f <branch-name>

# Atau buat worktree baru untuk branch tersebut
git worktree add -b <new-branch> ../new-worktree <base-branch>
```

## Script Helper

Lihat file `manage-worktree.ps1` untuk script helper yang lebih mudah digunakan.

## Catatan Penting

1. **Jangan hapus worktree manual** - Gunakan `git worktree remove`
2. **Commit sebelum pindah worktree** - Pastikan tidak ada uncommitted changes
3. **Sync dengan remote** - Pull terbaru sebelum mulai bekerja
4. **Limit worktree** - Jangan buat terlalu banyak worktree (max 5-10)

## Quick Reference

```powershell
# List worktree
git worktree list

# Add worktree
git worktree add <path> <branch>

# Remove worktree
git worktree remove <path>

# Prune worktree
git worktree prune

# Move to worktree
cd <worktree-path>

# Update worktree
git pull origin <branch>
```
