#!/bin/bash
BASE="http://localhost:8080/api/v1"
cat > /tmp/register.json << 'EOF'
{
  "first_name": "Jean",
  "last_name": "Test",
  "phone": "+243999888778",
  "email": "test@example.com",
  "password": "password123",
  "password_confirmation": "password123"
}
EOF
curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" -d @/tmp/register.json