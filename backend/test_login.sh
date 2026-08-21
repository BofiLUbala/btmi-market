#!/bin/sh
BASE="http://localhost:8080/api/v1"
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
echo "$RESP" | head -c 200
