# Postman Collection Guide

Panduan menggunakan Postman Collection untuk Production Report API.

---

## 📦 Import Collection ke Postman

### Method 1: Import File

1. Buka Postman
2. Klik **Import** di pojok kiri atas
3. Pilih **File** tab
4. Drag & drop file `postman-collection.json` atau klik **Choose Files**
5. Browse ke `odooAPI/postman-collection.json`
6. Klik **Import**

### Method 2: Import dari Text

1. Buka Postman
2. Klik **Import** 
3. Pilih **Raw text** tab
4. Copy semua isi file `postman-collection.json`
5. Paste ke text area
6. Klik **Import**

---

## ⚙️ Setup Environment Variables

Collection ini menggunakan 3 environment variables:

| Variable    | Default Value           | Description                              |
|-------------|-------------------------|------------------------------------------|
| `base_url`  | `http://localhost:1234` | Base URL server API                      |
| `mo_number` | `MO001`                 | Manufacturing Order Number untuk testing |
| `pic_name`  | `Puput Wijanarko`       | Nama PIC untuk testing                   |

### Cara Setup:

#### Option 1: Gunakan Collection Variables (Recommended)

Collection variables sudah di-set secara default, tinggal edit jika perlu:

1. Klik kanan pada collection **Production Report API**
2. Pilih **Edit**
3. Pergi ke tab **Variables**
4. Edit nilai sesuai kebutuhan
5. Klik **Save**

#### Option 2: Buat Environment Baru

1. Klik icon ⚙️ (gear) di pojok kanan atas
2. Klik **Add** untuk create environment baru
3. Beri nama: `Production Local` atau `Production VPS`
4. Tambahkan variables:
   ```
   base_url: http://localhost:1234
   mo_number: MO001
   pic_name: Puput Wijanarko
   ```
5. Klik **Save**
6. Pilih environment dari dropdown di pojok kanan atas

#### Contoh Environment untuk VPS:

```
Name: Production VPS
Variables:
- base_url: https://your-vps-domain.com
- mo_number: MO001
- pic_name: Puput Wijanarko
```

---

## 🚀 Cara Menggunakan

### 1. Test Basic Connection

Gunakan request **Health Check** untuk memastikan server berjalan:

```
GET {{base_url}}/health
```

Expected Response:
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": 12345.67,
  "timestamp": "2025-01-07T10:30:00.000Z"
}
```

### 2. Get All Production Report

Request pertama yang harus dicoba:

```
GET {{base_url}}/api/production/report
```

Response:
```json
{
  "success": true,
  "total": 150,
  "limit": null,
  "offset": 0,
  "data": [
    {
      "pic_input": "Puput Wijanarko",
      "sku_name": "LIQUID FREEBASE 10ML",
      "mo_number": "MO001",
      "roll": "R001",
      "first_authenticity_id": "FMX001",
      "last_authenticity_id": "FMX100",
      "production_type": "liquid",
      "created_at": "2025-01-07 10:30:00"
    }
  ]
}
```

### 3. Filter Examples

#### Filter by Type
```
GET {{base_url}}/api/production/report?type=liquid
GET {{base_url}}/api/production/report?type=device
GET {{base_url}}/api/production/report?type=cartridge
```

#### Filter by MO Number
```
GET {{base_url}}/api/production/report?mo_number={{mo_number}}
```

#### Filter by PIC
```
GET {{base_url}}/api/production/report?pic={{pic_name}}
```

#### Filter by Date Range
```
GET {{base_url}}/api/production/report?date_from=2025-01-01&date_to=2025-01-31
```

#### Filter by Status
```
GET {{base_url}}/api/production/report?status=active
GET {{base_url}}/api/production/report?status=completed
```

### 4. Pagination

```
# First page (0-20)
GET {{base_url}}/api/production/report?limit=20&offset=0

# Second page (21-40)
GET {{base_url}}/api/production/report?limit=20&offset=20

# Third page (41-60)
GET {{base_url}}/api/production/report?limit=20&offset=40
```

### 5. Combined Filters

```
GET {{base_url}}/api/production/report?type=liquid&status=active&date_from=2025-01-01&date_to=2025-01-31
```

---

## 📋 Collection Structure

```
Production Report API/
├── Production Report/
│   ├── Get All Production Report
│   ├── Filter by Type - Liquid
│   ├── Filter by Type - Device
│   ├── Filter by Type - Cartridge
│   ├── Filter by MO Number
│   ├── Filter by PIC Name
│   ├── Filter by Status - Active
│   ├── Filter by Status - Completed
│   ├── Filter by Date - Single Date
│   ├── Filter by Date Range
│   ├── Pagination - First Page
│   ├── Pagination - Second Page
│   ├── Combined Filters - Liquid + Active + Date
│   ├── Combined Filters - MO + Type
│   ├── Combined Filters - PIC + Date + Status
│   └── Full Example - All Filters
├── Other Production APIs/
│   ├── Get Production Liquid
│   ├── Get Production Device
│   ├── Get Production Cartridge
│   └── Get Production Combined
└── Health Check/
    └── Health Check
```

---

## 🔧 Customize Requests

### Edit Query Parameters

1. Buka request yang ingin diubah
2. Pergi ke tab **Params**
3. Edit value pada kolom **VALUE**
4. Atau uncheck parameter yang tidak digunakan
5. Klik **Send**

### Add New Query Parameters

1. Di tab **Params**, klik pada row kosong terakhir
2. Isi **KEY** dan **VALUE**
3. Klik **Send**

### Save Custom Request

1. Edit request sesuai kebutuhan
2. Klik **Save As**
3. Beri nama baru
4. Klik **Save**

---

## 📊 Response Structure

### Success Response

```json
{
  "success": true,
  "total": 100,
  "limit": 20,
  "offset": 0,
  "data": [
    {
      "pic_input": "string",
      "sku_name": "string",
      "mo_number": "string",
      "roll": "string",
      "first_authenticity_id": "string",
      "last_authenticity_id": "string",
      "leader_name": "string",
      "shift_number": "string",
      "status": "active|completed",
      "created_at": "YYYY-MM-DD HH:MM:SS",
      "completed_at": "YYYY-MM-DD HH:MM:SS|null",
      "production_type": "liquid|device|cartridge"
    }
  ]
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## 🎯 Common Use Cases

### 1. Daily Report

Get today's production:

```
GET {{base_url}}/api/production/report?date_from=2025-01-07&date_to=2025-01-07
```

### 2. Monthly Report

Get January 2025:

```
GET {{base_url}}/api/production/report?date_from=2025-01-01&date_to=2025-01-31
```

### 3. PIC Performance

Get specific PIC's work:

```
GET {{base_url}}/api/production/report?pic=Puput&date_from=2025-01-01&date_to=2025-01-31
```

### 4. MO Details

Get all data for specific MO:

```
GET {{base_url}}/api/production/report?mo_number=MO001
```

### 5. Active Production Only

Get only active (not completed) production:

```
GET {{base_url}}/api/production/report?status=active
```

---

## 🧪 Testing Workflow

### 1. Verify Server

```
1. Send: Health Check
   Expected: status = "healthy"
```

### 2. Basic Query

```
2. Send: Get All Production Report
   Expected: success = true, data array returned
```

### 3. Test Filters

```
3a. Send: Filter by Type - Liquid
    Expected: All records have production_type = "liquid"

3b. Send: Filter by Status - Active
    Expected: All records have status = "active"

3c. Send: Filter by Date Range
    Expected: All records within date range
```

### 4. Test Pagination

```
4a. Send: Pagination - First Page (limit=20, offset=0)
    Expected: Max 20 records

4b. Send: Pagination - Second Page (limit=20, offset=20)
    Expected: Next 20 records
```

### 5. Test Combined Filters

```
5. Send: Combined Filters - Liquid + Active + Date
   Expected: Records matching all filters
```

---

## 💡 Pro Tips

### 1. Save Responses

Postman allows you to save example responses:
1. After getting a response, click **Save Response**
2. Click **Save as Example**
3. Give it a meaningful name

### 2. Use Tests

Add automatic tests to verify responses:

```javascript
// Test status code
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Test response structure
pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});

// Test data array
pm.test("Response has data array", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.data).to.be.an('array');
});
```

### 3. Create Test Suites

Use Collection Runner to run all tests at once:
1. Click on collection name
2. Click **Run**
3. Select requests to run
4. Click **Run Production Report API**

### 4. Export Data

Save response to file:
1. Send request
2. Click **Save to file** button in response area
3. Choose location and save

---

## 🔄 Update Collection

When API changes:

1. Edit the request in Postman
2. Click **Save**
3. Export updated collection:
   - Right-click collection
   - Click **Export**
   - Choose **Collection v2.1**
   - Save and replace old `postman-collection.json`

---

## 🌐 Use with Different Environments

### Local Development
```
base_url: http://localhost:1234
```

### Staging Server
```
base_url: http://staging.yourdomain.com
```

### Production Server
```
base_url: https://api.yourdomain.com
```

Switch between environments using the dropdown in top-right corner.

---

## 📱 Share Collection

### Method 1: Share File

Share the `postman-collection.json` file directly.

### Method 2: Export Link

1. Right-click collection
2. Click **Share**
3. Click **Get Link**
4. Share the link with team

### Method 3: Workspace

1. Add collection to Postman Workspace
2. Invite team members to workspace

---

## ❓ Troubleshooting

### Error: Could not get response

**Cause:** Server tidak running atau URL salah

**Solution:**
1. Check if server is running: `npm start` in server directory
2. Verify `base_url` variable matches your server URL
3. Check firewall settings

### Error: 404 Not Found

**Cause:** Endpoint tidak ditemukan

**Solution:**
1. Verify server has the latest code
2. Check endpoint path spelling
3. Restart server

### Error: Connection Refused

**Cause:** Port tidak tersedia atau server down

**Solution:**
1. Check if server is running
2. Verify port number in `base_url`
3. Try different port if occupied

### Empty Data Array

**Cause:** Filter terlalu ketat atau no data in database

**Solution:**
1. Try without filters first
2. Check if data exists in database
3. Adjust filter parameters

---

## 📚 Additional Resources

- [Postman Documentation](https://learning.postman.com/docs/)
- [API Documentation](./PRODUCTION_REPORT_README.md)
- [Quick Start Guide](./QUICK_START.md)

---

## 📝 Changelog

### Version 1.0.0 (2025-01-07)
- Initial Postman collection
- 16 pre-configured requests
- Environment variables setup
- Complete documentation

---

**Need Help?** Contact the development team.

