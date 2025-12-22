# 🔧 FIX 500 ERROR - Permission Issue

## Masalah
Parent directory `/home/foom/deployments/manufacturing-app/` owned by `root:root`, sehingga Nginx (www-data) tidak bisa traverse ke `client-build`.

## Solusi Cepat (Jalankan di VPS)

```bash
# Fix ownership dan permission untuk SEMUA parent directories
sudo chown -R foom:foom /home/foom/deployments/manufacturing-app
sudo chmod 755 /home/foom/deployments/manufacturing-app
sudo chmod 755 /home/foom/deployments
sudo chmod 755 /home/foom

# Fix client-build
sudo chown -R foom:foom /home/foom/deployments/manufacturing-app/client-build
sudo find /home/foom/deployments/manufacturing-app/client-build -type d -exec chmod 755 {} \;
sudo find /home/foom/deployments/manufacturing-app/client-build -type f -exec chmod 644 {} \;

# Pastikan www-data bisa read
sudo chmod -R o+r /home/foom/deployments/manufacturing-app/client-build
sudo chmod o+x /home/foom/deployments/manufacturing-app/client-build
sudo chmod o+x /home/foom/deployments/manufacturing-app
sudo chmod o+x /home/foom/deployments
sudo chmod o+x /home/foom

# Test access sebagai www-data
sudo -u www-data test -r /home/foom/deployments/manufacturing-app/client-build/index.html && echo "✅ www-data can read" || echo "❌ www-data cannot read"

# Reload Nginx
sudo nginx -t && sudo systemctl reload nginx

# Test
curl -I https://mpr.moof-set.web.id
curl https://mpr.moof-set.web.id/api/health
```

## Atau Gunakan Script

```bash
cd /var/www/manufacturing-process-production-authenticity/nginx
chmod +x fix-permissions-complete.sh
sudo ./fix-permissions-complete.sh
```

## Jika Masih Error

Check error log:
```bash
sudo tail -50 /var/log/nginx/manufacturing-app-error.log
```

Jika masih permission denied, alternatif: pindahkan client-build ke `/var/www`:
```bash
sudo mv /home/foom/deployments/manufacturing-app/client-build /var/www/manufacturing-app-client
sudo chown -R www-data:www-data /var/www/manufacturing-app-client
# Update Nginx config: root /var/www/manufacturing-app-client;
```


