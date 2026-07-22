#!/bin/bash
# Setup dependencies dan test PostgreSQL connection di VPS

set -e

: "${DB_PASSWORD:?DB_PASSWORD is required}"

echo "=========================================="
echo "Setup Dependencies & Test PostgreSQL"
echo "=========================================="
echo ""

DEPLOY_PATH="$HOME/deployments/manufacturing-app"

echo "🔄 Step 1: Installing server dependencies..."
cd $DEPLOY_PATH/server

if [ ! -d "node_modules" ]; then
    echo "   Installing npm packages..."
    npm install
else
    echo "   Dependencies already installed, updating..."
    npm install
fi

echo ""
echo "🔄 Step 2: Verifying package 'pg' installed..."
if npm list pg > /dev/null 2>&1; then
    echo "   ✅ Package 'pg' is installed"
    npm list pg | grep pg
else
    echo "   ⚠️  Package 'pg' not found, installing..."
    npm install pg
fi

echo ""
echo "🔄 Step 3: Setting up .env file..."
if [ ! -f .env ]; then
    echo "   Creating .env from env.example..."
    cp env.example .env
fi

# Ensure DB_PORT=5433
if grep -q "^DB_PORT" .env; then
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env
else
    echo "DB_PORT=5433" >> .env
fi

# Ensure other DB settings
grep -q "^DB_HOST" .env || echo "DB_HOST=localhost" >> .env
grep -q "^DB_NAME" .env || echo "DB_NAME=manufacturing_db" >> .env
grep -q "^DB_USER" .env || echo "DB_USER=admin" >> .env
grep -q "^DB_PASSWORD" .env || echo "DB_PASSWORD=$DB_PASSWORD" >> .env

echo "   ✅ .env file configured"
echo ""
echo "   Current DB settings:"
grep "^DB_" .env

echo ""
echo "🔄 Step 4: Testing PostgreSQL connection..."
if [ -f test-postgresql-connection.js ]; then
    node test-postgresql-connection.js
else
    echo "   ⚠️  test-postgresql-connection.js not found"
    echo "   Testing manually with psql..."
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT current_user, current_database();" && {
        echo "   ✅ Connection successful!"
    } || {
        echo "   ❌ Connection failed"
    }
fi

echo ""
echo "=========================================="
echo "✅ Setup completed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Run migration: node migrate-to-postgresql.js"
echo "2. Build client: cd ../client && npm install && npm run build"
echo "3. Start app: pm2 start ecosystem.config.js"
