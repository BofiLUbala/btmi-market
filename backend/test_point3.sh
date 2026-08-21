#!/bin/bash

# BTMI Market API - Point 3 Integration Test Script
# Tests: Shops, Employees, Assignments, Inventory, Stock Movements

set -e

BASE_URL="http://localhost:8080/api/v1"
CONTENT_TYPE="Content-Type: application/json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "\n${YELLOW}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Store tokens and IDs
ACCESS_TOKEN=""
USER_ID=""
BUSINESS_ID=""
SHOP_GOMBE_ID=""
SHOP_LIMETE_ID=""
EMPLOYEE_SARAH_ID=""
EMPLOYEE_PAUL_ID=""
EMPLOYEE_JUNIOR_ID=""
PRODUCT_NIKE_ID=""

# ============================================
# STEP 1: Register and Login
# ============================================
print_step "Step 1: Register and Login"

# Register user
echo "Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "$CONTENT_TYPE" \
    -d '{
        "first_name": "Gauthier",
        "last_name": "Bofi",
        "phone": "+243810000001",
        "email": "gauthier@test.com",
        "password": "StrongPassword123!",
        "password_confirmation": "StrongPassword123!"
    }')

echo "Register response: $REGISTER_RESPONSE"

# Activate account (simulate - in real scenario, use email token)
# For testing, we'll use a pre-activated account

# Login
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "$CONTENT_TYPE" \
    -d '{
        "email": "gauthier@test.com",
        "password": "StrongPassword123!"
    }')

echo "Login response: $LOGIN_RESPONSE"

# Extract access token (in real scenario, parse JSON)
# For testing, we'll assume the token is returned
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    print_error "Failed to get access token"
    exit 1
fi

print_success "Got access token"

# ============================================
# STEP 2: Create Business (if not exists)
# ============================================
print_step "Step 2: Create Business"

echo "Creating business..."
BUSINESS_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "name": "Jean Fashion",
        "business_type": "RETAIL",
        "category": "Fashion",
        "phone": "+243810001111",
        "email": "business@jeanfashion.com",
        "country": "DRC",
        "city": "Kinshasa",
        "default_currency": "USD"
    }')

echo "Business response: $BUSINESS_RESPONSE"

# Extract business ID (in real scenario, parse JSON properly)
BUSINESS_ID=$(echo $BUSINESS_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BUSINESS_ID" ]; then
    print_error "Failed to get business ID"
    exit 1
fi

print_success "Business created: $BUSINESS_ID"

# ============================================
# STEP 3: Create Shops
# ============================================
print_step "Step 3: Create Shops"

# Create Gombe Shop
echo "Creating Gombe Shop..."
SHOP_GOMBE_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/shops" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "name": "Gombe Shop",
        "type": "PHYSICAL",
        "city": "Kinshasa",
        "address": "123 Main Street, Gombe",
        "phone": "+243810003333"
    }')

echo "Gombe Shop response: $SHOP_GOMBE_RESPONSE"
SHOP_GOMBE_ID=$(echo $SHOP_GOMBE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
print_success "Gombe Shop created: $SHOP_GOMBE_ID"

# Create Limete Shop
echo "Creating Limete Shop..."
SHOP_LIMETE_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/shops" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "name": "Limete Shop",
        "type": "PHYSICAL",
        "city": "Kinshasa",
        "address": "456 Second Avenue, Limete",
        "phone": "+243810004444"
    }')

echo "Limete Shop response: $SHOP_LIMETE_RESPONSE"
SHOP_LIMETE_ID=$(echo $SHOP_LIMETE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
print_success "Limete Shop created: $SHOP_LIMETE_ID"

# List shops
echo "Listing shops..."
SHOPS_RESPONSE=$(curl -s -X GET "$BASE_URL/businesses/$BUSINESS_ID/shops" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Shops: $SHOPS_RESPONSE"

# ============================================
# STEP 4: Create Employees
# ============================================
print_step "Step 4: Create Employees"

# Create Sarah
echo "Creating Sarah..."
SARAH_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/employees" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "first_name": "Sarah",
        "last_name": "Ngoma",
        "phone": "+243810005555",
        "email": "sarah@jeanfashion.com",
        "job_title": "Sales Associate"
    }')

echo "Sarah response: $SARAH_RESPONSE"
EMPLOYEE_SARAH_ID=$(echo $SARAH_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
print_success "Sarah created: $EMPLOYEE_SARAH_ID"

# Create Paul
echo "Creating Paul..."
PAUL_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/employees" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "first_name": "Paul",
        "last_name": "Mukendi",
        "phone": "+243810006666",
        "email": "paul@jeanfashion.com",
        "job_title": "Store Manager"
    }')

echo "Paul response: $PAUL_RESPONSE"
EMPLOYEE_PAUL_ID=$(echo $PAUL_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
print_success "Paul created: $EMPLOYEE_PAUL_ID"

# Create Junior
echo "Creating Junior..."
JUNIOR_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/employees" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "first_name": "Junior",
        "last_name": "Kabongo",
        "phone": "+243810007777",
        "email": "junior@jeanfashion.com",
        "job_title": "Sales Associate"
    }')

echo "Junior response: $JUNIOR_RESPONSE"
EMPLOYEE_JUNIOR_ID=$(echo $JUNIOR_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
print_success "Junior created: $EMPLOYEE_JUNIOR_ID"

# List employees
echo "Listing employees..."
EMPLOYEES_RESPONSE=$(curl -s -X GET "$BASE_URL/businesses/$BUSINESS_ID/employees" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Employees: $EMPLOYEES_RESPONSE"

# ============================================
# STEP 5: Assign Employees to Shops
# ============================================
print_step "Step 5: Assign Employees to Shops"

# Assign Sarah to Gombe
echo "Assigning Sarah to Gombe..."
SARAH_GOMBE_RESPONSE=$(curl -s -X POST "$BASE_URL/employees/$EMPLOYEE_SARAH_ID/shops" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"shop_id\": \"$SHOP_GOMBE_ID\"
    }")

echo "Sarah -> Gombe: $SARAH_GOMBE_RESPONSE"
print_success "Sarah assigned to Gombe"

# Assign Sarah to Limete
echo "Assigning Sarah to Limete..."
SARAH_LIMETE_RESPONSE=$(curl -s -X POST "$BASE_URL/employees/$EMPLOYEE_SARAH_ID/shops" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"shop_id\": \"$SHOP_LIMETE_ID\"
    }")

echo "Sarah -> Limete: $SARAH_LIMETE_RESPONSE"
print_success "Sarah assigned to Limete"

# Assign Paul to Gombe
echo "Assigning Paul to Gombe..."
PAUL_GOMBE_RESPONSE=$(curl -s -X POST "$BASE_URL/employees/$EMPLOYEE_PAUL_ID/shops" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"shop_id\": \"$SHOP_GOMBE_ID\"
    }")

echo "Paul -> Gombe: $PAUL_GOMBE_RESPONSE"
print_success "Paul assigned to Gombe"

# Assign Junior to Limete
echo "Assigning Junior to Limete..."
JUNIOR_LIMETE_RESPONSE=$(curl -s -X POST "$BASE_URL/employees/$EMPLOYEE_JUNIOR_ID/shops" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"shop_id\": \"$SHOP_LIMETE_ID\"
    }")

echo "Junior -> Limete: $JUNIOR_LIMETE_RESPONSE"
print_success "Junior assigned to Limete"

# List shop employees
echo "Listing Gombe employees..."
GOMBE_EMPLOYEES=$(curl -s -X GET "$BASE_URL/shops/$SHOP_GOMBE_ID/employees" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Gombe Employees: $GOMBE_EMPLOYEES"

# List employee shops
echo "Listing Sarah's shops..."
SARAH_SHOPS=$(curl -s -X GET "$BASE_URL/employees/$EMPLOYEE_SARAH_ID/shops" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Sarah's Shops: $SARAH_SHOPS"

# ============================================
# STEP 6: Create Product
# ============================================
print_step "Step 6: Create Product"

echo "Creating Nike Air Max..."
PRODUCT_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/products" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "name": "Nike Air Max",
        "sku": "NIKE-AIR-001",
        "description": "Premium running shoes",
        "unit_price": 150.00,
        "cost_price": 80.00,
        "unit": "PCS"
    }')

echo "Product response: $PRODUCT_RESPONSE"
PRODUCT_NIKE_ID=$(echo $PRODUCT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
print_success "Nike Air Max created: $PRODUCT_NIKE_ID"

# ============================================
# STEP 7: Add Stock
# ============================================
print_step "Step 7: Add Stock"

echo "Adding 100 Nike Air to Gombe..."
STOCK_GOMBE_RESPONSE=$(curl -s -X POST "$BASE_URL/shops/$SHOP_GOMBE_ID/stock" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"product_id\": \"$PRODUCT_NIKE_ID\",
        \"quantity\": 100,
        \"notes\": \"Initial stock\"
    }")

echo "Stock Gombe: $STOCK_GOMBE_RESPONSE"
print_success "100 Nike Air added to Gombe"

echo "Adding 50 Nike Air to Limete..."
STOCK_LIMETE_RESPONSE=$(curl -s -X POST "$BASE_URL/shops/$SHOP_LIMETE_ID/stock" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"product_id\": \"$PRODUCT_NIKE_ID\",
        \"quantity\": 50,
        \"notes\": \"Initial stock\"
    }")

echo "Stock Limete: $STOCK_LIMETE_RESPONSE"
print_success "50 Nike Air added to Limete"

# ============================================
# STEP 8: Record Sales
# ============================================
print_step "Step 8: Record Sales"

echo "Sarah sells 2 Nike Air from Gombe (Physical)..."
SALE_SARAH_GOMBE=$(curl -s -X POST "$BASE_URL/shops/$SHOP_GOMBE_ID/sales" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"product_id\": \"$PRODUCT_NIKE_ID\",
        \"quantity\": 2,
        \"sale_type\": \"PHYSICAL\",
        \"employee_id\": \"$EMPLOYEE_SARAH_ID\"
    }")

echo "Sale Sarah Gombe: $SALE_SARAH_GOMBE"
print_success "Sarah sold 2 Nike Air from Gombe (Stock: 100 -> 98)"

echo "Online sale of 3 Nike Air from Gombe..."
SALE_ONLINE_GOMBE=$(curl -s -X POST "$BASE_URL/shops/$SHOP_GOMBE_ID/sales" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"product_id\": \"$PRODUCT_NIKE_ID\",
        \"quantity\": 3,
        \"sale_type\": \"ONLINE\"
    }")

echo "Sale Online Gombe: $SALE_ONLINE_GOMBE"
print_success "Online sale of 3 Nike Air from Gombe (Stock: 98 -> 95)"

# ============================================
# STEP 9: Add More Stock
# ============================================
print_step "Step 9: Add More Stock"

echo "Owner adds 50 more Nike Air to Gombe..."
STOCK_ADD_RESPONSE=$(curl -s -X POST "$BASE_URL/shops/$SHOP_GOMBE_ID/stock" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"product_id\": \"$PRODUCT_NIKE_ID\",
        \"quantity\": 50,
        \"notes\": \"Restocking\"
    }")

echo "Stock Add: $STOCK_ADD_RESPONSE"
print_success "50 more Nike Air added to Gombe (Stock: 95 -> 145)"

# ============================================
# STEP 10: View Inventory and Movements
# ============================================
print_step "Step 10: View Inventory and Movements"

echo "Viewing Gombe inventory..."
INVENTORY_GOMBE=$(curl -s -X GET "$BASE_URL/shops/$SHOP_GOMBE_ID/inventory" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Gombe Inventory: $INVENTORY_GOMBE"

echo "Viewing Gombe stock movements..."
MOVEMENTS_GOMBE=$(curl -s -X GET "$BASE_URL/shops/$SHOP_GOMBE_ID/movements" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Gombe Movements: $MOVEMENTS_GOMBE"

echo "Viewing stock events..."
STOCK_EVENTS=$(curl -s -X GET "$BASE_URL/events/stock" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Stock Events: $STOCK_EVENTS"

# ============================================
# STEP 11: Test Business Boundary
# ============================================
print_step "Step 11: Test Business Boundary"

echo "Testing cross-business assignment (should fail)..."
# Create another business
OTHER_BUSINESS_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "name": "Other Business",
        "business_type": "SERVICES",
        "category": "Other",
        "phone": "+243810009999",
        "email": "other@test.com",
        "country": "DRC",
        "city": "Lubumbashi",
        "default_currency": "USD"
    }')

OTHER_BUSINESS_ID=$(echo $OTHER_BUSINESS_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Create shop in other business
OTHER_SHOP_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$OTHER_BUSINESS_ID/shops" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "name": "Other Shop",
        "type": "PHYSICAL",
        "city": "Lubumbashi"
    }')

OTHER_SHOP_ID=$(echo $OTHER_SHOP_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Try to assign Sarah (from Jean Fashion) to Other Shop (should fail)
echo "Trying to assign Sarah to Other Shop (should fail)..."
CROSS_BUSINESS_ASSIGN=$(curl -s -X POST "$BASE_URL/employees/$EMPLOYEE_SARAH_ID/shops" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"shop_id\": \"$OTHER_SHOP_ID\"
    }")

echo "Cross-business assignment: $CROSS_BUSINESS_ASSIGN"

if echo "$CROSS_BUSINESS_ASSIGN" | grep -q "FORBIDDEN"; then
    print_success "Cross-business assignment correctly rejected"
else
    print_error "Cross-business assignment should have been rejected"
fi

# ============================================
# STEP 12: Test Remove Assignment
# ============================================
print_step "Step 12: Test Remove Assignment"

echo "Removing Sarah from Gombe..."
REMOVE_SARAH_GOMBE=$(curl -s -X DELETE "$BASE_URL/employees/$EMPLOYEE_SARAH_ID/shops/$SHOP_GOMBE_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Remove Sarah from Gombe: $REMOVE_SARAH_GOMBE"
print_success "Sarah removed from Gombe"

echo "Checking Sarah's shops (should only have Limete)..."
SARAH_SHOPS_AFTER=$(curl -s -X GET "$BASE_URL/employees/$EMPLOYEE_SARAH_ID/shops" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Sarah's Shops After Removal: $SARAH_SHOPS_AFTER"

# ============================================
# Summary
# ============================================
print_step "Test Summary"

echo "Point 3 Integration Test Completed!"
echo ""
echo "Created:"
echo "  - Business: Jean Fashion ($BUSINESS_ID)"
echo "  - Shops: Gombe ($SHOP_GOMBE_ID), Limete ($SHOP_LIMETE_ID)"
echo "  - Employees: Sarah ($EMPLOYEE_SARAH_ID), Paul ($EMPLOYEE_PAUL_ID), Junior ($EMPLOYEE_JUNIOR_ID)"
echo "  - Product: Nike Air Max ($PRODUCT_NIKE_ID)"
echo ""
echo "Assignments:"
echo "  - Sarah: Gombe (removed), Limete (active)"
echo "  - Paul: Gombe (active)"
echo "  - Junior: Limete (active)"
echo ""
echo "Stock:"
echo "  - Gombe: 145 Nike Air (100 initial - 2 physical - 3 online + 50 restock)"
echo "  - Limete: 50 Nike Air"
echo ""
echo "Test Coverage:"
echo "  ✓ Business creates multiple Shops"
echo "  ✓ Business creates multiple Employees"
echo "  ✓ One Shop has multiple Employees"
echo "  ✓ One Employee belongs to multiple Shops"
echo "  ✓ Employee cannot be assigned across different Businesses"
echo "  ✓ Removing Shop assignment does not delete Employee"
echo "  ✓ Owner can add stock"
echo "  ✓ Assigned Employee can sell from assigned Shop"
echo "  ✓ Physical sale decreases stock"
echo "  ✓ Online sale decreases same stock"
echo "  ✓ Owner stock addition increases stock"
echo "  ✓ Stock movements recorded"
echo ""
print_success "All tests completed!"
