#!/bin/bash
# Setup script for Staging Manufacturing Order database
# This script creates the staging database and grants privileges to the admin user

set -e

# Configuration
DB_NAME="Staging_Manufacturing_Order"
DB_USER="admin"
DB_PASSWORD="Admin123"
DB_HOST="localhost"
DB_PORT="${DB_PORT:-5433}"

# Superuser configuration (for creating database if admin doesn't have permission)
SUPERUSER="${POSTGRES_SUPERUSER:-postgres}"
SUPERUSER_PASSWORD="${POSTGRES_SUPERUSER_PASSWORD:-}"

echo "🗄️  Setting up staging database: $DB_NAME"
echo "📍 Database host: $DB_HOST"
echo "📍 Database port: $DB_PORT"
echo "📍 Database user: $DB_USER"

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Check if PostgreSQL is accessible
echo "🔍 Checking PostgreSQL connection..."
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT version();" > /dev/null 2>&1; then
    echo "❌ ERROR: Cannot connect to PostgreSQL"
    echo "   Please verify:"
    echo "   - PostgreSQL is running"
    echo "   - Host: $DB_HOST"
    echo "   - Port: $DB_PORT"
    echo "   - User: $DB_USER"
    echo "   - Password is correct"
    exit 1
fi

echo "✅ PostgreSQL connection successful"

# Create database if it doesn't exist
echo "📋 Checking if database $DB_NAME exists..."
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 && echo "yes" || echo "no")

if [ "$DB_EXISTS" = "yes" ]; then
    echo "✅ Database $DB_NAME already exists"
else
    echo "📦 Creating database $DB_NAME..."
    
    # Try to create database with admin user first
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null; then
        echo "✅ Database $DB_NAME created successfully with user $DB_USER"
    else
        echo "⚠️  User $DB_USER doesn't have permission to create database"
        echo "   Attempting to create database using superuser $SUPERUSER..."
        
        # Try with superuser
        if [ -n "$SUPERUSER_PASSWORD" ]; then
            export PGPASSWORD="$SUPERUSER_PASSWORD"
        else
            # Try without password (might work with sudo or peer auth)
            unset PGPASSWORD
        fi
        
        # Try sudo -u postgres first (most common)
        if sudo -u "$SUPERUSER" psql -h "$DB_HOST" -p "$DB_PORT" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null; then
            echo "✅ Database $DB_NAME created successfully using sudo -u $SUPERUSER"
        elif [ -n "$SUPERUSER_PASSWORD" ] && psql -h "$DB_HOST" -p "$DB_PORT" -U "$SUPERUSER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null; then
            echo "✅ Database $DB_NAME created successfully using superuser $SUPERUSER"
        else
            echo "❌ ERROR: Cannot create database. Please run manually:"
            echo ""
            echo "   Option 1: Using superuser:"
            echo "   sudo -u postgres psql -p $DB_PORT -c \"CREATE DATABASE \\\"$DB_NAME\\\";\""
            echo ""
            echo "   Option 2: Or set POSTGRES_SUPERUSER_PASSWORD environment variable:"
            echo "   export POSTGRES_SUPERUSER_PASSWORD='your_postgres_password'"
            echo "   ./setup-staging-database.sh"
            echo ""
            echo "   Option 3: Grant CREATEDB permission to admin user:"
            echo "   sudo -u postgres psql -p $DB_PORT -c \"ALTER USER \\\"$DB_USER\\\" CREATEDB;\""
            exit 1
        fi
        
        # Restore admin password for subsequent operations
        export PGPASSWORD="$DB_PASSWORD"
    fi
fi

# Grant privileges on database
echo "🔐 Granting privileges on database $DB_NAME to user $DB_USER..."
# Try with admin user first, fallback to superuser if needed
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO \"$DB_USER\";" 2>/dev/null; then
    echo "✅ Database privileges granted"
else
    echo "⚠️  User $DB_USER doesn't have permission to grant privileges"
    echo "   Attempting to grant privileges using superuser..."
    
    if [ -n "$SUPERUSER_PASSWORD" ]; then
        export PGPASSWORD="$SUPERUSER_PASSWORD"
    else
        unset PGPASSWORD
    fi
    
    if sudo -u "$SUPERUSER" psql -h "$DB_HOST" -p "$DB_PORT" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO \"$DB_USER\";" 2>/dev/null; then
        echo "✅ Database privileges granted using superuser"
    elif [ -n "$SUPERUSER_PASSWORD" ] && psql -h "$DB_HOST" -p "$DB_PORT" -U "$SUPERUSER" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO \"$DB_USER\";" 2>/dev/null; then
        echo "✅ Database privileges granted using superuser"
    else
        echo "⚠️  Could not grant privileges automatically. Please run manually:"
        echo "   sudo -u postgres psql -p $DB_PORT -c \"GRANT ALL PRIVILEGES ON DATABASE \\\"$DB_NAME\\\" TO \\\"$DB_USER\\\";\""
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
fi

# Connect to the database and grant schema privileges
echo "🔐 Granting schema privileges..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
-- Grant privileges on schema
GRANT ALL ON SCHEMA public TO "$DB_USER";

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "$DB_USER";

-- Grant privileges on existing objects (if any)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "$DB_USER";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "$DB_USER";
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO "$DB_USER";
EOF

echo "✅ Schema privileges granted"

# Verify database access
echo "🔍 Verifying database access..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_database(), current_user;" > /dev/null 2>&1; then
    echo "✅ Database access verified"
else
    echo "❌ ERROR: Cannot access database $DB_NAME"
    exit 1
fi

# Unset password
unset PGPASSWORD

echo ""
echo "✅ Staging database setup completed successfully!"
echo "📍 Database: $DB_NAME"
echo "📍 User: $DB_USER"
echo "📍 Host: $DB_HOST"
echo "📍 Port: $DB_PORT"
echo ""
echo "💡 The database is ready for the staging application to use."
