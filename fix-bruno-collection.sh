#!/bin/bash

echo "🔧 Fixing Bruno Collection Setup"
echo "================================"

cd test-collection

echo -e "\n1. Renaming collection.bru to avoid conflicts:"
if [ -f collection.bru ]; then
    mv collection.bru collection.bru.backup
    echo "   ✅ Renamed collection.bru to collection.bru.backup"
else
    echo "   ℹ️  collection.bru not found"
fi

echo -e "\n2. Ensuring bruno.json exists:"
if [ ! -f bruno.json ]; then
    cat > bruno.json << 'EOF'
{
  "version": "1",
  "name": "Test API Collection",
  "type": "collection"
}
EOF
    echo "   ✅ Created minimal bruno.json"
else
    echo "   ✅ bruno.json already exists"
fi

echo -e "\n3. Testing collection with fixed setup:"
echo "   Running: npx bru run . -r"
npx bru run . -r

echo -e "\n4. If that worked, let's also test:"
echo "   a) Single request:"
npx bru run "Users/Get All Users.bru" 2>&1 | head -20

echo -e "\n   b) JSON output:"
npx bru run . -r --format json --output results.json
if [ -f results.json ]; then
    echo "   ✅ JSON output created"
    echo "   First 500 chars:"
    head -c 500 results.json
    echo ""
else
    echo "   ❌ No JSON output"
fi

cd ..

echo -e "\n✅ Fix complete!"