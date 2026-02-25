# Quick Guide: Manage Worktree

Panduan cepat untuk manage worktree di project ini.

## Status Worktree Saat Ini

Berdasarkan `git worktree list`, Anda memiliki:

```
✅ Main repository: [staging]
✅ boa: [KMI]
⚠️  ehz: (detached HEAD) - Perlu diperbaiki
⚠️  gyl: (detached HEAD) - Perlu diperbaiki
⚠️  jop: (detached HEAD) - Perlu diperbaiki
⚠️  lhk: (detached HEAD) - Perlu diperbaiki
⚠️  rcw: (detached HEAD) - Perlu diperbaiki
⚠️  spi: (detached HEAD) - Perlu diperbaiki
⚠️  ybj: (detached HEAD) - Perlu diperbaiki
```

## Masalah: Detached HEAD

Worktree dengan status "detached HEAD" berarti tidak terikat ke branch tertentu. Ini perlu diperbaiki.

## Solusi Cepat

### 1. Gunakan Script Helper

Saya sudah membuat script `manage-worktree.ps1` untuk memudahkan:

```powershell
# List semua worktree
.\manage-worktree.ps1 list

# Lihat status detail
.\manage-worktree.ps1 status

# Sync semua worktree
.\manage-worktree.ps1 sync
```

### 2. Perbaiki Detached HEAD

Untuk worktree yang detached HEAD, pilih salah satu:

**Opsi A: Checkout ke branch yang sesuai**
```powershell
# Masuk ke worktree
cd C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\ybj

# Checkout ke branch staging
git checkout staging

# Atau checkout ke branch lain sesuai kebutuhan
git checkout main
git checkout KMI
```

**Opsi B: Hapus worktree yang tidak digunakan**
```powershell
# Hapus worktree yang tidak diperlukan
git worktree remove C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\ehz
git worktree remove C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\jop
# ... dst
```

## Rekomendasi Struktur Worktree

Berdasarkan project Anda, struktur yang disarankan:

```
Main Repository:
  - Branch: staging (atau main)
  - Purpose: Primary development

Worktree: boa
  - Branch: KMI
  - Purpose: KMI feature development

Worktree: ybj (atau pilih satu)
  - Branch: staging
  - Purpose: Staging environment testing

Worktree lainnya: Hapus jika tidak digunakan
```

## Command Penting

### List Worktree
```powershell
git worktree list
```

### Checkout Branch di Worktree
```powershell
cd <worktree-path>
git checkout <branch-name>
```

### Hapus Worktree
```powershell
git worktree remove <worktree-path>
```

### Prune Invalid Worktree
```powershell
git worktree prune
```

## Quick Actions

### Setup Worktree untuk Staging
```powershell
# Jika ybj ingin digunakan untuk staging
cd C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\ybj
git checkout staging
```

### Cleanup Worktree yang Tidak Digunakan
```powershell
# Hapus worktree yang detached HEAD dan tidak digunakan
git worktree remove C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\ehz
git worktree remove C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\jop
git worktree remove C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\lhk
git worktree remove C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\rcw
git worktree remove C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\spi
git worktree remove C:\Users\info\.cursor\worktrees\Manufacturing-Process-Production-Authenticity\gyl
```

**Catatan:** Hanya hapus jika benar-benar tidak digunakan!

## Tips

1. **Gunakan script helper** - `manage-worktree.ps1` lebih mudah
2. **Jangan terlalu banyak worktree** - Max 3-5 worktree aktif
3. **Checkout ke branch yang jelas** - Hindari detached HEAD
4. **Sync secara berkala** - Pull terbaru dari remote

## Next Steps

1. Tentukan worktree mana yang akan digunakan
2. Checkout ke branch yang sesuai
3. Hapus worktree yang tidak diperlukan
4. Gunakan script helper untuk manage sehari-hari
