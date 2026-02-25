# 🚀 Quick Start - Push ke GitHub

## ⚠️ Error yang Terjadi
```
remote: Repository not found.
fatal: repository 'https://github.com/Bearson-norm/manufacturing-process-production-authenticity.git/' not found
```

**Penyebab**: Repository belum dibuat di GitHub.

## ✅ Solusi

### Step 1: Buat Repository di GitHub

1. **Buka GitHub** → https://github.com
2. **Login** dengan akun `Bearson-norm`
3. **Klik tombol "+"** di kanan atas → **"New repository"**
4. **Isi form**:
   - **Repository name**: `manufacturing-process-production-authenticity`
   - **Description**: `Manufacturing Process Production Authenticity System`
   - **Visibility**: Pilih **Private** atau **Public**
   - **JANGAN centang**:
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
5. **Klik "Create repository"**

### Step 2: Push ke GitHub

Setelah repository dibuat, jalankan command berikut di PowerShell:

```powershell
# Perbaiki typo: ggit -> git
git push -u origin main
```

Jika masih error, coba:

```powershell
# Verifikasi remote
git remote -v

# Jika perlu update remote URL
git remote set-url origin https://github.com/Bearson-norm/manufacturing-process-production-authenticity.git

# Push lagi
git push -u origin main
```

### Step 3: Jika Diminta Authentication

Jika diminta username/password:
- **Username**: `Bearson-norm`
- **Password**: Gunakan **Personal Access Token** (bukan password GitHub)

**Cara buat Personal Access Token**:
1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token (classic)
4. Berikan permission: `repo` (full control)
5. Copy token dan gunakan sebagai password

## ✅ Checklist

- [ ] Repository dibuat di GitHub
- [ ] Repository name: `manufacturing-process-production-authenticity`
- [ ] Username: `Bearson-norm`
- [ ] Command: `git push -u origin main` (bukan `ggit`)
- [ ] Personal Access Token sudah dibuat (jika diperlukan)

## 🎯 Setelah Push Berhasil

Setelah push berhasil, lanjutkan dengan:
1. Setup GitHub Secrets (lihat `SETUP_GITHUB.md`)
2. Setup VPS (lihat `DEPLOYMENT.md`)
3. Test deployment

