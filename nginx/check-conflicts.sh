#!/bin/bash

# Script to check for conflicting Nginx server names

echo "🔍 Checking for conflicting server names in Nginx configs..."
echo ""

# Check all enabled sites
echo "📋 Enabled sites:"
ls -la /etc/nginx/sites-enabled/
echo ""

# Check for duplicate server_name
echo "🔍 Searching for 'mpr.moof-set.web.id' in Nginx configs..."
grep -r "server_name.*mpr.moof-set.web.id" /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null || echo "No conflicts found in sites-available/enabled"

echo ""
echo "📋 All server_name entries:"
grep -r "server_name" /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "^#" | grep -v "^$"

echo ""
echo "💡 If you see duplicate server_name for mpr.moof-set.web.id:"
echo "   1. Check /etc/nginx/sites-enabled/ for duplicate configs"
echo "   2. Remove or disable the old config"
echo "   3. Run: sudo nginx -t && sudo systemctl reload nginx"

