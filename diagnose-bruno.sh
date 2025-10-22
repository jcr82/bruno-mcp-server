#!/bin/bash

echo "🔍 Diagnosing Bruno Collection Setup"
echo "====================================="

echo -e "\n1. Current directory structure:"
tree test-collection 2>/dev/null || find test-collection -type f -name "*.bru" -o -name "*.json"

echo -e "\n2. Check for Bruno configuration files:"
echo "   - bruno.json: $([ -f test-collection/bruno.json ] && echo '✅ Found' || echo '❌ Missing')"
echo "   - collection.bru: $([ -f test-collection/collection.bru ] && echo '✅ Found' || echo '❌ Missing')"

echo -e "\n3. Try initializing Bruno collection (if needed):"
cd test-collection

# Check if we can see what Bruno expects
echo -e "\n4. Bruno's view of this directory:"
npx bru --version

echo -e "\n5. Testing different approaches:"

echo -e "\n   a) Try running from collection root with bruno.json:"
if [ -f bruno.json ]; then
    echo "      Running: npx bru run ."
    npx bru run . 2>&1 | head -10
else
    echo "      ❌ bruno.json not found"
fi

echo -e "\n   b) List .bru files:"
find . -name "*.bru" -type f | head -5

echo -e "\n   c) Try running a specific .bru file directly:"
if [ -f "Users/Get All Users.bru" ]; then
    echo "      Running: npx bru run 'Users/Get All Users.bru'"
    npx bru run "Users/Get All Users.bru" 2>&1 | head -10
fi

cd ..

echo -e "\n6. Alternative: Create a minimal bruno.json and test:"
if [ ! -f test-collection/bruno.json ]; then
    echo '{"version":"1","name":"Test Collection","type":"collection"}' > test-collection/bruno.json
    echo "   Created minimal bruno.json"
fi

cd test-collection
echo -e "\n7. Final test with bruno.json:"
npx bru run . -r --format json 2>&1 | head -20

cd ..
echo -e "\n✅ Diagnosis complete!"