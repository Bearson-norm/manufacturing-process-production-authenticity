# Cara Mengirim Data ke Receiver Endpoint

## Endpoint
**POST** `http://localhost:1234/api/receiver/test`

## Request yang Akan Dikirim

```json
{
  "source": "active",
  "data": {
    "mo_number": "PROD/MO/28246",
    "status": "active"
  }
}
```

---

## Metode 1: Menggunakan cURL (Terminal/PowerShell)

### Windows PowerShell

```powershell
curl.exe -X POST http://localhost:1234/api/receiver/test `
  -H "Content-Type: application/json" `
  -d '{\"source\": \"active\", \"data\": {\"mo_number\": \"PROD/MO/28246\", \"status\": \"active\"}}'
```

**Atau dengan Invoke-RestMethod (Lebih Mudah):**

```powershell
$body = @{
    source = "active"
    data = @{
        mo_number = "PROD/MO/28246"
        status = "active"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:1234/api/receiver/test" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### Linux/Mac Terminal

```bash
curl -X POST http://localhost:1234/api/receiver/test \
  -H "Content-Type: application/json" \
  -d '{"source": "active", "data": {"mo_number": "PROD/MO/28246", "status": "active"}}'
```

---

## Metode 2: Menggunakan Postman

1. **Buka Postman**
2. **Method:** Pilih `POST`
3. **URL:** `http://localhost:1234/api/receiver/test`
4. **Headers:**
   - Key: `Content-Type`
   - Value: `application/json`
5. **Body:**
   - Pilih tab `raw`
   - Pilih `JSON` di dropdown
   - Masukkan:
   ```json
   {
     "source": "active",
     "data": {
       "mo_number": "PROD/MO/28246",
       "status": "active"
     }
   }
   ```
6. **Klik Send**

---

## Metode 3: Menggunakan Browser (JavaScript Console)

Buka browser console (F12) di halaman `http://localhost:3000` atau halaman manapun, lalu jalankan:

```javascript
fetch('http://localhost:1234/api/receiver/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    source: 'active',
    data: {
      mo_number: 'PROD/MO/28246',
      status: 'active'
    }
  })
})
.then(response => response.json())
.then(data => {
  console.log('Success:', data);
})
.catch(error => {
  console.error('Error:', error);
});
```

---

## Metode 4: Menggunakan PowerShell Script File

Buat file `test-receiver.ps1`:

```powershell
# test-receiver.ps1
$url = "http://localhost:1234/api/receiver/test"
$body = @{
    source = "active"
    data = @{
        mo_number = "PROD/MO/28246"
        status = "active"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $url `
        -Method POST `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "❌ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
```

Jalankan:
```powershell
.\test-receiver.ps1
```

---

## Metode 5: Menggunakan Node.js Script

Buat file `test-receiver.js`:

```javascript
// test-receiver.js
const https = require('http'); // atau 'https' jika menggunakan HTTPS

const data = JSON.stringify({
  source: 'active',
  data: {
    mo_number: 'PROD/MO/28246',
    status: 'active'
  }
});

const options = {
  hostname: 'localhost',
  port: 1234,
  path: '/api/receiver/test',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', JSON.parse(responseData));
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
```

Jalankan:
```bash
node test-receiver.js
```

---

## Expected Response

### Success Response

```json
{
  "success": true,
  "received_at": "2024-01-15T10:30:00.000Z",
  "source": "active",
  "data_size": 123,
  "message": "Data received successfully",
  "mo_number": "PROD/MO/28246",
  "status": "active"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Invalid source. Must be one of: fallback, active, completed"
}
```

---

## Variasi Request

### 1. Source: "completed"

```powershell
$body = @{
    source = "completed"
    data = @{
        mo_number = "PROD/MO/28246"
        status = "completed"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:1234/api/receiver/test" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### 2. Source: "fallback"

```powershell
$body = @{
    source = "fallback"
    data = @{
        mo_number = "PROD/MO/28246"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:1234/api/receiver/test" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### 3. Menggunakan Query Parameter

Anda juga bisa set source via query parameter:

```powershell
Invoke-RestMethod -Uri "http://localhost:1234/api/receiver/test?source=active" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"mo_number": "PROD/MO/28246", "status": "active"}'
```

---

## Verifikasi Data Diterima

Setelah mengirim, cek log yang diterima:

```bash
# Via cURL
curl http://localhost:1234/api/receiver/test/logs

# Via PowerShell
Invoke-RestMethod -Uri "http://localhost:1234/api/receiver/test/logs"
```

**Response:**
```json
{
  "success": true,
  "total": 1,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "id": 1,
      "source": "active",
      "payload": "{\"mo_number\":\"PROD/MO/28246\",\"status\":\"active\"}",
      "received_at": "2024-01-15T10:30:00.000Z",
      "response_status": 200,
      "response_message": "Data received successfully",
      "ip_address": "::1",
      "user_agent": "curl/7.68.0"
    }
  ]
}
```

---

## Troubleshooting

### Error: "Connection refused"

**Penyebab:** Server tidak running

**Solusi:**
```bash
npm run dev
```

### Error: "Invalid source"

**Penyebab:** Source tidak valid

**Valid sources:** `fallback`, `active`, `completed`

### Error: "Cannot POST"

**Penyebab:** URL salah atau endpoint tidak terdaftar

**Solusi:** Pastikan URL: `http://localhost:1234/api/receiver/test`

---

## Quick Test Commands

### Windows PowerShell (Paling Mudah)

```powershell
# Test active
$body = '{"source":"active","data":{"mo_number":"PROD/MO/28246","status":"active"}}'
Invoke-RestMethod -Uri "http://localhost:1234/api/receiver/test" -Method POST -ContentType "application/json" -Body $body

# Test completed
$body = '{"source":"completed","data":{"mo_number":"PROD/MO/28246","status":"completed"}}'
Invoke-RestMethod -Uri "http://localhost:1234/api/receiver/test" -Method POST -ContentType "application/json" -Body $body

# View logs
Invoke-RestMethod -Uri "http://localhost:1234/api/receiver/test/logs"
```

### Linux/Mac

```bash
# Test active
curl -X POST http://localhost:1234/api/receiver/test \
  -H "Content-Type: application/json" \
  -d '{"source":"active","data":{"mo_number":"PROD/MO/28246","status":"active"}}'

# View logs
curl http://localhost:1234/api/receiver/test/logs
```
