# Manufacturing Process API Documentation

## 🔐 API Authentication

Semua endpoint external API memerlukan API key untuk autentikasi. API key dapat di-generate dan dikonfigurasi melalui halaman Admin.

### Cara Menggunakan API Key

#### Option 1: Menggunakan Header `X-API-Key`
```bash
curl -X GET "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28246&completed_at=all" \
  -H "X-API-Key: your_api_key_here"
```

#### Option 2: Menggunakan Header `Authorization` (Bearer Token)
```bash
curl -X GET "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28246&completed_at=all" \
  -H "Authorization: Bearer your_api_key_here"
```

### Generate API Key

1. Login ke halaman Admin
2. Buka halaman Admin Configuration
3. Klik tombol "Generate API Key"
4. **PENTING**: Simpan API key yang di-generate dengan aman - API key hanya ditampilkan sekali saat di-generate
5. Gunakan API key ini di semua request ke external API endpoints

### Catatan Keamanan

- ⚠️ **Jika API key belum dikonfigurasi**, endpoint external API dapat diakses tanpa autentikasi (backward compatibility)
- ✅ **Setelah API key dikonfigurasi**, semua request ke external API **harus** menyertakan API key yang valid
- 🔒 API key disimpan di database dengan format terenkripsi
- 📝 API key yang ditampilkan di halaman Admin adalah versi yang di-mask (hanya 8 karakter terakhir yang terlihat)

### Error Responses

#### Missing API Key
```json
{
  "success": false,
  "error": "API key is required. Please provide X-API-Key header or Authorization Bearer token."
}
```

#### Invalid API Key
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

---

## External API Endpoint: Get Manufacturing Data by MO Number

### Endpoint
```
GET /api/external/manufacturing-data
```

**⚠️ Requires API Key Authentication**

### Authentication
**⚠️ REQUIRED**: This endpoint requires API Key authentication.

The API token must be configured in the Admin panel (Admin → Configuration → External API Authentication Token).

Include the API key in the request header:
- Header name: `X-API-Key: <your-token>`
- Or: `Authorization: Bearer <your-token>`

**Example:**
```bash
curl -H "X-API-Key: your-api-token-here" \
  "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204"
```

**Note**: If no API token is configured in the Admin panel, the endpoint will be accessible without authentication (backward compatibility mode). However, **it is strongly recommended to configure an API token for production use**.

### Description
Retrieve comprehensive manufacturing process data for a specific MO Number, **only for completed records**. The API returns all sessions, production data, buffer authenticity, and rejected authenticity for MO entries that have been marked as completed.

**Important**: 
- MO Number format is `PROD/MO/xxxx` (e.g., PROD/MO/28204)
- The same MO Number can appear in different production types (liquid, device, cartridge)
- **Production type is determined by which production page (liquid/device/cartridge) was used to input the data, NOT by the MO Number format**
- The API automatically searches across all three production types and returns all matching completed records

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mo_number` | string | Yes | Manufacturing Order number to query |
| `completed_at` | string | No | Filter by completion date (format: YYYY-MM-DD) or "all" for all completed records |

**Note**: The API only returns records with `status = 'completed'`. Records that are still active will not be included in the response.

### Response Format

```json
{
  "success": true,
  "mo_number": "PROD/MO/28204",
  "completed_at": "all",
  "total_sessions": 1,
  "data": [
    {
      "session": "Hikmatul Iman_Shift1_1705123456789",
      "leader": "Hikmatul Iman",
      "shift": "Shift1",
      "mo_data": [
        {
          "mo_number": "PROD/MO/28204",
          "sku_name": "Product A",
          "pic": "John Doe",
          "production_type": "device",
          "completed_at": "2024-01-15 10:30:00",
          "authenticity_data": [
            {
              "first_authenticity": "AUTH001",
              "last_authenticity": "AUTH100",
              "roll_number": "ROLL001"
            },
            {
              "first_authenticity": "AUTH101",
              "last_authenticity": "AUTH200",
              "roll_number": "ROLL002"
            }
          ],
          "buffered_auth": ["BUFFER001", "BUFFER002"],
          "rejected_auth": ["REJECT001"]
        }
      ]
    }
  ]
}
```

**Note**: `production_type` indicates which production page was used to input this data (device/liquid/cartridge), not derived from the MO Number format.

### Example Requests

#### Example 1: Get all completed data for a specific MO Number (bash/Linux/Mac)
```bash
# With API Key authentication
curl -X GET "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all" \
  -H "X-API-Key: your_api_key_here"

# Or using Authorization header
curl -X GET "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all" \
  -H "Authorization: Bearer your_api_key_here"
```

#### Example 2: PowerShell (Windows)
PowerShell uses `Invoke-RestMethod` or `Invoke-WebRequest`. Use this format:

```powershell
# Set your API key
$apiKey = "your_api_key_here"

# Option 1: Using Invoke-RestMethod (recommended, returns parsed JSON)
$headers = @{
    "X-API-Key" = $apiKey
}
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all" -Method Get -Headers $headers
$response | ConvertTo-Json -Depth 10

# Option 2: Using Invoke-WebRequest (returns full HTTP response)
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all" -Method Get -Headers $headers
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Option 3: Using curl.exe (actual curl, not PowerShell alias)
curl.exe -X GET "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all" -H "X-API-Key: $apiKey"
```

**Note**: In PowerShell, `curl` is an alias for `Invoke-WebRequest`. To use actual curl, use `curl.exe`.

#### Example 3: Get completed data with date filter
```bash
# bash/Linux/Mac
curl -X GET "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=2024-01-15" \
  -H "X-API-Key: your_api_key_here"

# PowerShell
$headers = @{ "X-API-Key" = "your_api_key_here" }
Invoke-RestMethod -Uri "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=2024-01-15" -Method Get -Headers $headers
```

#### Example 4: Using JavaScript/Axios
```javascript
const axios = require('axios');

async function getManufacturingData(moNumber, completedAt = 'all', apiKey) {
  try {
    const response = await axios.get('http://localhost:3000/api/external/manufacturing-data', {
      params: {
        mo_number: moNumber,
        completed_at: completedAt
      },
      headers: {
        'X-API-Key': apiKey  // Required: API key authentication
      }
    });
    
    console.log('Total Sessions:', response.data.total_sessions);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('Authentication failed: Invalid or missing API key');
    } else {
      console.error('Error:', error.response?.data || error.message);
    }
  }
}

// Usage with actual MO Number format: PROD/MO/xxxx
const API_KEY = 'your_api_key_here';  // Get from environment variable or config
getManufacturingData('PROD/MO/28204', 'all', API_KEY);
getManufacturingData('PROD/MO/28204', '2024-01-15', API_KEY);
```

### Response Fields Description

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the request was successful |
| `mo_number` | string | The MO Number that was queried |
| `completed_at` | string | The completion date filter applied or "all" |
| `total_sessions` | number | Total number of unique sessions found |
| `data` | array | Array of session objects |
| `data[].session` | string | Unique session identifier |
| `data[].leader` | string | Leader name for the session |
| `data[].shift` | string | Shift number |
| `data[].mo_data` | array | Array of MO data entries |
| `data[].mo_data[].mo_number` | string | Manufacturing Order number |
| `data[].mo_data[].sku_name` | string | Product SKU name |
| `data[].mo_data[].pic` | string | Person In Charge name |
| `data[].mo_data[].production_type` | string | Type of production (liquid, device, cartridge) |
| `data[].mo_data[].completed_at` | string\|null | Timestamp when completed (null if not completed) |
| `data[].mo_data[].authenticity_data` | array | Array of authenticity data with roll numbers |
| `data[].mo_data[].authenticity_data[].first_authenticity` | string | First authenticity number in the range |
| `data[].mo_data[].authenticity_data[].last_authenticity` | string | Last authenticity number in the range |
| `data[].mo_data[].authenticity_data[].roll_number` | string | Roll number identifier |
| `data[].mo_data[].buffered_auth` | array | Array of buffered authenticity numbers |
| `data[].mo_data[].rejected_auth` | array | Array of rejected authenticity numbers |

### Error Responses

#### Missing MO Number
```json
{
  "success": false,
  "error": "MO Number is required"
}
```

#### No Data Found
```json
{
  "success": true,
  "mo_number": "MO999",
  "completed_at": "all",
  "total_sessions": 0,
  "data": []
}
```
**Note**: This could mean either the MO doesn't exist or it exists but hasn't been marked as completed yet.

#### Server Error
```json
{
  "success": false,
  "error": "Database connection error"
}
```

### Use Case Scenarios

#### Scenario 1: Single MO in One Session (Completed)
Query PROD/MO/28204 which was completed in one session with multiple rolls:

```bash
GET /api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all
```

Response shows:
- 1 session
- 1 MO entry (with status = completed)
- Multiple authenticity data entries (one per roll number)
- All buffer and reject data for that MO
- `production_type` indicates which production page was used (liquid/device/cartridge)

**Note**: Only completed records are returned. If PROD/MO/28204 has active (not completed) entries, they will be excluded.

#### Scenario 2: Same MO Number in Different Production Types
The same MO Number (e.g., PROD/MO/28204) can be input in multiple production pages. Query will return all:

```bash
GET /api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all
```

Response could show:
- PROD/MO/28204 with `production_type: "device"` (input via Production Device page)
- PROD/MO/28204 with `production_type: "liquid"` (input via Production Liquid page)
- PROD/MO/28204 with `production_type: "cartridge"` (input via Production Cartridge page)

Each entry has its own authenticity data, buffers, and rejects.

#### Scenario 3: Same MO Completed Across Multiple Sessions
Query PROD/MO/28204 which was processed and completed across different shifts/sessions:

```bash
GET /api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all
```

Response shows:
- Multiple sessions
- Each session contains completed PROD/MO/28204 data
- Separate buffer and reject data per session

**Note**: Only sessions where PROD/MO/28204 entries have been marked as completed are included.

### Notes

1. **Completed Status Only**: The API **only returns records with status = 'completed'**. Any production entries that are still active (not yet completed) will be excluded from the response.

2. **Marking as Completed**: Records are marked as completed when the user clicks the "Submit" button in the production interface, which triggers the update-status endpoint.

3. **Multiple Roll Numbers**: When an input has multiple roll numbers, each will appear as a separate entry in `authenticity_data` array.

2. **Buffer and Reject Data**: The `buffered_auth` and `rejected_auth` arrays contain all buffer/reject entries that match the MO number, regardless of which session they were created in.

3. **Completed At Filter**: 
   - Use `completed_at=all` to get all completed records regardless of completion date
   - Use `completed_at=YYYY-MM-DD` to filter by specific completion date
   - Omit the parameter to get all completed records (same as "all")

4. **Production Types**: 
   - The API aggregates data from three production types: `liquid`, `device`, `cartridge`
   - **Production type is determined by which production page the user used to input the data**
   - The MO Number format (PROD/MO/xxxx) does NOT determine the production type
   - The same MO Number can exist in multiple production types if entered in different production pages

5. **Session Grouping**: All data is grouped by `session_id` which is unique per manufacturing session (combination of leader name, shift number, and timestamp).

6. **Completion Workflow**: 
   - User inputs data → status is 'active'
   - User clicks "Submit" button → status changes to 'completed' and `completed_at` timestamp is set
   - Only then will the data appear in this external API

### Integration Tips

1. **Polling for Updates**: Set up periodic polling if you need real-time updates:
```javascript
setInterval(() => {
  getManufacturingData('MO001', 'all');
}, 60000); // Check every minute
```

2. **Data Aggregation**: Aggregate data across multiple MO numbers:
```javascript
async function getMultipleMOs(moNumbers) {
  const promises = moNumbers.map(mo => 
    getManufacturingData(mo, 'all')
  );
  return await Promise.all(promises);
}
```

3. **Date Filtering**: Filter data by date range on client side:
```javascript
function filterByDateRange(data, startDate, endDate) {
  return data.data.flatMap(session => 
    session.mo_data.filter(mo => {
      const completedAt = new Date(mo.completed_at);
      return completedAt >= startDate && completedAt <= endDate;
    })
  );
}
```

---

## External API Endpoint: Get MO Status

### Endpoint
```
GET /api/external/manufacturing-data/status
```

### Authentication
**⚠️ REQUIRED**: This endpoint requires API Key authentication (same as `/api/external/manufacturing-data`).

The API token must be configured in the Admin panel (Admin → Configuration → External API Authentication Token).

Include the API key in the request header:
- Header name: `X-API-Key: <your-token>`
- Or: `Authorization: Bearer <your-token>`

### Description
Check the overall status of a Manufacturing Order (MO) across all production types. Returns `"active"` if there are any active (not completed) inputs, or `"completed"` if all inputs for that MO are completed.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mo_number` | string | Yes | Manufacturing Order number to check |
| `completed_at` | string | No | Filter by completion date (format: YYYY-MM-DD) or "all" for all records |

### Response Format

#### If MO has active inputs:
```json
{
  "status": "active"
}
```

#### If all MO inputs are completed:
```json
{
  "status": "completed"
}
```

#### If MO not found:
```json
{
  "success": false,
  "error": "MO number not found",
  "status": null
}
```

### Example Requests

```bash
# With API Key
curl -X GET "http://localhost:3000/api/external/manufacturing-data/status?mo_number=PROD/MO/28246&completed_at=all" \
  -H "X-API-Key: your_api_key_here"
```

```javascript
// JavaScript/Axios
const axios = require('axios');

async function getMOStatus(moNumber, apiKey) {
  try {
    const response = await axios.get('http://localhost:3000/api/external/manufacturing-data/status', {
      params: {
        mo_number: moNumber,
        completed_at: 'all'
      },
      headers: {
        'X-API-Key': apiKey
      }
    });
    
    console.log('MO Status:', response.data.status);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

getMOStatus('PROD/MO/28246', 'your_api_key_here');
```

### Notes

1. **Status Logic**: 
   - Returns `"active"` if ANY production type (liquid/device/cartridge) has active inputs for the MO
   - Returns `"completed"` only if ALL inputs across ALL production types are completed
   - Returns error if MO number doesn't exist in any production table

2. **Production Types**: The endpoint checks all three production types (liquid, device, cartridge) automatically.

3. **Use Case**: Useful for quickly checking if an MO is still in progress or fully completed.

---

## API Key Setup & Configuration

### Setting Up API Key

#### 1. Generate Secure API Key

**Linux/Mac:**
```bash
openssl rand -hex 32
```

**Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**PowerShell (Windows):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

#### 2. Configure in Environment File

Edit `server/.env`:
```env
API_KEY=your_generated_api_key_here
```

#### 3. Restart Application

```bash
# Development
npm run dev

# Production (PM2)
pm2 restart manufacturing-app
```

### Using API Key in Requests

#### cURL
```bash
curl -H "X-API-Key: your_api_key_here" \
  "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204"
```

#### JavaScript/Axios
```javascript
axios.get('http://localhost:3000/api/external/manufacturing-data', {
  params: { mo_number: 'PROD/MO/28204' },
  headers: { 'X-API-Key': 'your_api_key_here' }
});
```

#### Python/Requests
```python
import requests

headers = {'X-API-Key': 'your_api_key_here'}
response = requests.get(
    'http://localhost:3000/api/external/manufacturing-data',
    params={'mo_number': 'PROD/MO/28204'},
    headers=headers
)
```

### Security Notes

1. **Never commit API key to Git**: Always use `.env` file (already in `.gitignore`)
2. **Use different keys for different environments**: Dev, staging, production
3. **Rotate keys periodically**: Change API key every 3-6 months
4. **Share keys securely**: Use secure channels (not email, not chat)
5. **Monitor usage**: Check logs for unauthorized access attempts

### Error Responses

#### Missing API Key
```json
{
  "success": false,
  "error": "Unauthorized: API key is required. Please provide X-API-Key header or Authorization: Bearer <key>"
}
```

#### Invalid API Key
```json
{
  "success": false,
  "error": "Unauthorized: Invalid API key"
}
```

---

### Database Schema Reference

The API queries the following tables:
- `production_liquid`, `production_device`, `production_cartridge` - Main production data
- `buffer_liquid`, `buffer_device`, `buffer_cartridge` - Buffer authenticity data
- `reject_liquid`, `reject_device`, `reject_cartridge` - Reject authenticity data

Each production table has a `completed_at` timestamp that is automatically set when the status is changed to "completed".

