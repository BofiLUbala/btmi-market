#!/bin/bash
# Full API Integration Test Script

BASE="http://localhost:8080/api/v1"
PASS=0
FAIL=0

test_result() {
    local desc="$1" expected="$2" actual="$3"
    if echo "$actual" | grep -q "$expected"; then
        echo "PASS: $desc"
        PASS=$((PASS+1))
    else
        echo "FAIL: $desc (expected: $expected, got: $actual)"
        FAIL=$((FAIL+1))
    fi
}

echo "=== 1. HEALTH CHECK ==="
HEALTH=$(curl -s http://localhost:8080/health)
test_result "Health endpoint" "ok" "$HEALTH"

echo ""
echo "=== 2. REGISTER - Valid ==="
REG=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Gauthier","middle_name":"Example","last_name":"Bofi","phone":"+243810000001","email":"test@example.com","password":"StrongPassword123!","password_confirmation":"StrongPassword123!"}')
test_result "Register valid user" "user_id" "$REG"
echo "Response: $REG"

echo ""
echo "=== 3. REGISTER - Duplicate Email ==="
DUP_EMAIL=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Gauthier","middle_name":"Example","last_name":"Bofi","phone":"+243810000099","email":"test@example.com","password":"StrongPassword123!","password_confirmation":"StrongPassword123!"}')
test_result "Duplicate email" "EMAIL_ALREADY_EXISTS" "$DUP_EMAIL"
echo "Response: $DUP_EMAIL"

echo ""
echo "=== 4. REGISTER - Duplicate Phone ==="
DUP_PHONE=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Gauthier","middle_name":"Example","last_name":"Bofi","phone":"+243810000001","email":"other@example.com","password":"StrongPassword123!","password_confirmation":"StrongPassword123!"}')
test_result "Duplicate phone" "PHONE_ALREADY_EXISTS" "$DUP_PHONE"
echo "Response: $DUP_PHONE"

echo ""
echo "=== 5. REGISTER - Password Mismatch ==="
PW_MISMATCH=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Gauthier","middle_name":"Example","last_name":"Bofi","phone":"+243810000002","email":"test2@example.com","password":"StrongPassword123!","password_confirmation":"DifferentPassword!"}')
test_result "Password mismatch" "PASSWORD_CONFIRMATION_MISMATCH" "$PW_MISMATCH"
echo "Response: $PW_MISMATCH"

echo ""
echo "=== 6. REGISTER - Weak Password ==="
WEAK_PW=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Gauthier","middle_name":"Example","last_name":"Bofi","phone":"+243810000003","email":"test3@example.com","password":"weak","password_confirmation":"weak"}')
test_result "Weak password" "PASSWORD_TOO_WEAK" "$WEAK_PW"
echo "Response: $WEAK_PW"

echo ""
echo "=== 7. REGISTER - Missing Fields ==="
MISS_FIELDS=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test4@example.com"}')
test_result "Missing fields" "INVALID_REQUEST" "$MISS_FIELDS"
echo "Response: $MISS_FIELDS"

echo ""
echo "=== 8. LOGIN - Before Activation (should fail) ==="
LOGIN_BEFORE=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"StrongPassword123!"}')
test_result "Login before activation" "ACCOUNT_NOT_ACTIVATED" "$LOGIN_BEFORE"
echo "Response: $LOGIN_BEFORE"

echo ""
echo "=== 9. ACTIVATE ACCOUNT ==="
# First get the activation token from the dev logs
# In dev mode, the token is logged to stdout
# We need to extract it from docker logs
sleep 1
DEV_LOG=$(docker compose logs api 2>&1 | grep "Activation URL" | tail -1 | sed 's/.*token=//')
echo "Extracted token: $DEV_LOG"
if [ -z "$DEV_LOG" ]; then
    echo "WARNING: Could not extract token from logs, trying to get from API directly"
    # Try getting from the database directly
    ACTIVATE="INVALID_TOKEN"
else
    ACTIVATE=$(curl -s -X GET "$BASE/auth/activate?token=$DEV_LOG")
fi
test_result "Activate account" "Account activated" "$ACTIVATE"
echo "Response: $ACTIVATE"

echo ""
echo "=== 10. LOGIN - After Activation ==="
LOGIN_AFTER=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"StrongPassword123!"}')
test_result "Login after activation" "access_token" "$LOGIN_AFTER"
echo "Response: $LOGIN_AFTER"

# Extract tokens
ACCESS_TOKEN=$(echo "$LOGIN_AFTER" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "")
REFRESH_TOKEN=$(echo "$LOGIN_AFTER" | python3 -c "import sys, json; print(json.load(sys.stdin)['refresh_token'])" 2>/dev/null || echo "")

if [ -z "$ACCESS_TOKEN" ]; then
    # Try with jq alternative
    ACCESS_TOKEN=$(echo "$LOGIN_AFTER" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$LOGIN_AFTER" | grep -o '"refresh_token":"[^"]*"' | cut -d'"' -f4)
fi

echo "Access Token: ${ACCESS_TOKEN:0:50}..."

echo ""
echo "=== 11. ACTIVATE AGAIN - Already Used ==="
if [ -n "$DEV_LOG" ]; then
    ACTIVATE_AGAIN=$(curl -s -X GET "$BASE/auth/activate?token=$DEV_LOG")
    test_result "Activate again (already used)" "ACTIVATION_LINK_ALREADY_USED" "$ACTIVATE_AGAIN"
    echo "Response: $ACTIVATE_AGAIN"
else
    echo "SKIP: No token available"
fi

echo ""
echo "=== 12. ACTIVATE - Invalid Token ==="
INVALID_ACT=$(curl -s -X GET "$BASE/auth/activate?token=invalidtoken123")
test_result "Activate invalid token" "ACTIVATION_LINK_INVALID" "$INVALID_ACT"
echo "Response: $INVALID_ACT"

echo ""
echo "=== 13. CREATE BUSINESS ==="
if [ -n "$ACCESS_TOKEN" ]; then
    CREATE_BIZ=$(curl -s -X POST "$BASE/businesses" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{"name":"Jean Fashion","business_type":"RETAIL","category":"Fashion","phone":"+243810001111","whatsapp":"+243810002222","email":"business@example.com","country":"DRC","city":"Kinshasa","default_currency":"USD"}')
    test_result "Create business" "Business created" "$CREATE_BIZ"
    echo "Response: $CREATE_BIZ"
    BUSINESS_ID=$(echo "$CREATE_BIZ" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "Business ID: $BUSINESS_ID"
else
    echo "SKIP: No access token available"
fi

echo ""
echo "=== 14. CREATE BUSINESS - Without Auth ==="
NO_AUTH_BIZ=$(curl -s -X POST "$BASE/businesses" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","business_type":"RETAIL","category":"Test","phone":"+243810003333","email":"test@test.com","country":"DRC","city":"Kinshasa","default_currency":"USD"}')
test_result "Create business without auth" "UNAUTHORIZED" "$NO_AUTH_BIZ"
echo "Response: $NO_AUTH_BIZ"

echo ""
echo "=== 15. LIST BUSINESSES ==="
if [ -n "$ACCESS_TOKEN" ]; then
    LIST_BIZ=$(curl -s -X GET "$BASE/businesses" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    test_result "List businesses" "Jean Fashion" "$LIST_BIZ"
    echo "Response: $LIST_BIZ"
else
    echo "SKIP: No access token available"
fi

echo ""
echo "=== 16. GET BUSINESS BY ID ==="
if [ -n "$ACCESS_TOKEN" ] && [ -n "$BUSINESS_ID" ]; then
    GET_BIZ=$(curl -s -X GET "$BASE/businesses/$BUSINESS_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    test_result "Get business by ID" "Jean Fashion" "$GET_BIZ"
    echo "Response: $GET_BIZ"
else
    echo "SKIP: No access token or business ID available"
fi

echo ""
echo "=== 17. REFRESH TOKEN ==="
if [ -n "$REFRESH_TOKEN" ]; then
    REFRESH=$(curl -s -X POST "$BASE/auth/refresh" \
      -H "Content-Type: application/json" \
      -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")
    test_result "Refresh token" "access_token" "$REFRESH"
    echo "Response: $REFRESH"
else
    echo "SKIP: No refresh token available"
fi

echo ""
echo "=== 18. RESEND ACTIVATION ==="
RESEND=$(curl -s -X POST "$BASE/auth/resend-activation" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')
test_result "Resend activation (already active)" "ACCOUNT_ALREADY_ACTIVE" "$RESEND"
echo "Response: $RESEND"

echo ""
echo "=== 19. LOGIN - Wrong Password ==="
WRONG_PW=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"WrongPassword123!"}')
test_result "Login wrong password" "INVALID_CREDENTIALS" "$WRONG_PW"
echo "Response: $WRONG_PW"

echo ""
echo "=== 20. LOGIN - Unknown Account ==="
UNKNOWN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"StrongPassword123!"}')
test_result "Login unknown account" "INVALID_CREDENTIALS" "$UNKNOWN"
echo "Response: $UNKNOWN"

echo ""
echo "============================="
echo "RESULTS: PASS=$PASS FAIL=$FAIL"
echo "============================="
