package main

import (
	"encoding/json"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const tokenSecret = "r-wwQg3EAy8hztugvrQyW4q5cTTHt_oSKHAqMKFb75Wk2F2O-4dJo16GzOUynYYh9KVjGufpNBM6WIb7myBzwA"

func mint(sub, email, typ string) string {
	claims := jwt.MapClaims{
		"sub":          sub,
		"email":        email,
		"account_type": typ,
		"iat":          time.Now().Unix(),
		"exp":          time.Now().Add(55 * time.Minute).Unix(),
	}
	t, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(tokenSecret))
	return t
}

func main() {
	out := map[string]string{
		"BUYER_RUNTIME": mint("ee2e7050-4bc6-407b-b670-98d82a215b9b", "runtimebuyer@test.com", "BUYER"),
		"SELLER_TRADER": mint("2f63c00d-2733-4e5b-b4c1-23f18f8326c4", "bofigauthier3@gmail.com", "SELLER"),
	}
	b, _ := json.Marshal(out)
	println(string(b))
}
