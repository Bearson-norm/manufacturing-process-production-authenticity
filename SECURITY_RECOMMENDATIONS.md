# Security Recommendations untuk Production

## ⚠️ URGENT: Implementasi Sebelum Deploy ke VPS

### 1. API Key Authentication untuk External API

**Status Saat Ini**: ❌ Tidak ada authentication  
**Risk Level**: 🔴 HIGH  
**Impact**: External API bisa diakses siapa saja tanpa authorization

**Solusi**:

#### Option A: Simple API Key (Recommended untuk Start)
Tambahkan middleware di `server/index.js`:

```javascript
// Add after other middleware
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    return res.status(500).json({
      success: false,
      error: 'API Key not configured on server'
    });
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing API key'
    });
  }
  
  next();
};

// Apply to external API endpoint
app.get('/api/external/manufacturing-data', apiKeyAuth, async (req, res) => {
  // ... existing code
});
```

Tambahkan di `.env`:
```env
API_KEY=your_very_secure_random_api_key_change_this
```

**Generate secure API key**:
```bash
# Linux/Mac
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Option B: JWT Token (Advanced)
Untuk authentication yang lebih robust dengan expiration.

#### Option C: OAuth 2.0 (Enterprise)
Untuk integrasi dengan existing auth system.

---

### 2. CORS Configuration

**Status Saat Ini**: ❌ Terlalu permissive (`app.use(cors())`)  
**Risk Level**: 🟡 MEDIUM  
**Impact**: Any domain bisa akses API

**Solusi**:

```javascript
// Replace app.use(cors()) with:
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000'];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

Di `.env`:
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

### 3. Rate Limiting

**Status Saat Ini**: ❌ Tidak ada rate limiting  
**Risk Level**: 🟠 MEDIUM-HIGH  
**Impact**: Vulnerable to DDoS, API abuse

**Solusi**:

Install package:
```bash
cd server
npm install express-rate-limit
```

Tambahkan di `server/index.js`:
```javascript
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for external API
const externalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: {
    success: false,
    error: 'Too many API requests, please try again later.'
  }
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/api/external/', externalApiLimiter);
```

---

### 4. Environment Variables

**Status Saat Ini**: ❌ Tidak ada `.env` file  
**Risk Level**: 🟡 MEDIUM  
**Impact**: Sensitive data in code

**Solusi**:

Install dotenv:
```bash
cd server
npm install dotenv
```

Di awal `server/index.js`:
```javascript
require('dotenv').config();
```

Buat `.env` file (lihat `.env.example`)

**IMPORTANT**: Tambahkan ke `.gitignore`:
```
.env
*.sqlite
*.sqlite-wal
*.sqlite-shm
logs/
```

---

### 5. Input Validation

**Status Saat Ini**: ⚠️ Basic validation  
**Risk Level**: 🟡 MEDIUM  
**Impact**: SQL injection, XSS

**Solusi**:

Install validator:
```bash
cd server
npm install validator express-validator
```

Tambahkan validation untuk external API:
```javascript
const { query, validationResult } = require('express-validator');

app.get('/api/external/manufacturing-data',
  apiKeyAuth,
  externalApiLimiter,
  [
    query('mo_number')
      .notEmpty().withMessage('MO Number is required')
      .trim()
      .escape(),
    query('completed_at')
      .optional()
      .matches(/^(all|\d{4}-\d{2}-\d{2})$/)
      .withMessage('Invalid date format. Use YYYY-MM-DD or "all"')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    // ... rest of your code
  }
);
```

---

### 6. HTTPS/SSL

**Status Saat Ini**: ❌ HTTP only  
**Risk Level**: 🔴 HIGH (for production)  
**Impact**: Data transmitted in plaintext

**Solusi**:

Use Let's Encrypt with Nginx (see VPS_DEPLOYMENT_GUIDE.md)

Or for Node.js directly:
```javascript
const https = require('https');
const fs = require('fs');

if (process.env.NODE_ENV === 'production') {
  const options = {
    key: fs.readFileSync('/path/to/privkey.pem'),
    cert: fs.readFileSync('/path/to/fullchain.pem')
  };
  
  https.createServer(options, app).listen(443, () => {
    console.log('HTTPS Server running on port 443');
  });
} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}
```

---

### 7. Security Headers

**Solusi**:

Install helmet:
```bash
cd server
npm install helmet
```

Tambahkan di `server/index.js`:
```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
```

---

### 8. Logging & Monitoring

**Solusi**:

Install winston for better logging:
```bash
cd server
npm install winston
```

Setup logger:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Use logger instead of console.log
logger.info('Server started');
logger.error('Error occurred', { error: err });
```

Log API access:
```javascript
app.use((req, res, next) => {
  logger.info('API Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    apiKey: req.headers['x-api-key'] ? '***' : 'none'
  });
  next();
});
```

---

### 9. Database Security

**Recommendations**:

1. **Regular Backups**: Automated daily backups (see VPS_DEPLOYMENT_GUIDE.md)
2. **Access Control**: Limit file permissions
   ```bash
   chmod 660 database.sqlite
   ```
3. **Encryption at Rest**: For highly sensitive data
4. **Connection Pooling**: Already implemented with WAL mode

---

### 10. Error Handling

**Don't expose internal errors**:

```javascript
// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path 
  });
  
  // Don't send stack trace to client in production
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});
```

---

## Implementation Checklist

Before deploying to VPS:

- [ ] Add API key authentication to external API
- [ ] Configure CORS with allowed origins
- [ ] Implement rate limiting
- [ ] Setup environment variables (.env)
- [ ] Add input validation
- [ ] Setup HTTPS/SSL
- [ ] Add security headers (helmet)
- [ ] Implement proper logging
- [ ] Setup database backups
- [ ] Add error handling middleware
- [ ] Change default login credentials
- [ ] Test all security measures
- [ ] Document API key for clients
- [ ] Setup monitoring/alerting

---

## Testing Security

### Test API Key:
```bash
# Should fail (no API key)
curl http://localhost:3000/api/external/manufacturing-data?mo_number=TEST

# Should fail (wrong API key)
curl -H "X-API-Key: wrong_key" http://localhost:3000/api/external/manufacturing-data?mo_number=TEST

# Should succeed
curl -H "X-API-Key: your_correct_key" http://localhost:3000/api/external/manufacturing-data?mo_number=TEST
```

### Test Rate Limiting:
```bash
# Run 100+ times rapidly
for i in {1..110}; do 
  curl -H "X-API-Key: your_key" http://localhost:3000/api/external/manufacturing-data?mo_number=TEST
done
```

### Test CORS:
```bash
# Should be blocked if origin not allowed
curl -H "Origin: http://evil-site.com" http://localhost:3000/api/health
```

---

## Priority Implementation Order

**Phase 1 (Before VPS Deploy)** - Critical:
1. API Key Authentication
2. Environment Variables
3. CORS Configuration

**Phase 2 (During VPS Setup)** - Important:
4. HTTPS/SSL
5. Rate Limiting
6. Security Headers

**Phase 3 (Post-Deploy)** - Enhancement:
7. Advanced Logging
8. Monitoring
9. Automated Backups
10. Input Validation Enhancement

---

## Support & Updates

Keep packages updated:
```bash
npm audit
npm audit fix
npm update
```

Monitor security advisories:
- GitHub Security Alerts
- npm security advisories
- Node.js security releases

