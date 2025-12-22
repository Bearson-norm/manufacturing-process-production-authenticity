#!/bin/bash

# Quick test for all endpoints

echo "🧪 Testing all endpoints..."
echo ""

echo "1️⃣  Backend direct (port 1234):"
curl -s http://localhost:1234/health | jq . 2>/dev/null || curl -s http://localhost:1234/health
echo ""
echo ""

echo "2️⃣  Nginx HTTP /health:"
curl -s http://mpr.moof-set.web.id/health 2>&1 | head -5
echo ""
echo ""

echo "3️⃣  Nginx HTTP /api/health:"
curl -s http://mpr.moof-set.web.id/api/health 2>&1 | head -5
echo ""
echo ""

echo "4️⃣  Nginx HTTPS /health (skip SSL verify):"
curl -sk https://mpr.moof-set.web.id/health | jq . 2>/dev/null || curl -sk https://mpr.moof-set.web.id/health
echo ""
echo ""

echo "5️⃣  Nginx HTTPS /api/health (skip SSL verify):"
curl -sk https://mpr.moof-set.web.id/api/health | jq . 2>/dev/null || curl -sk https://mpr.moof-set.web.id/api/health
echo ""
echo ""

echo "✅ Testing complete!"
echo ""
echo "Note: SSL certificate verification errors are normal if certificate doesn't match hostname."
echo "Use -k flag to skip SSL verification for testing."

