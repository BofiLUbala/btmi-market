package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func loadSecret() string {
	f, err := os.Open(".env")
	if err != nil {
		fmt.Fprintln(os.Stderr, "open .env:", err)
		os.Exit(1)
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if strings.HasPrefix(line, "JWT_SECRET=") {
			return strings.Trim(line[len("JWT_SECRET="):], `"'`)
		}
	}
	fmt.Fprintln(os.Stderr, "JWT_SECRET not found")
	os.Exit(1)
	return ""
}

func main() {
	secret := []byte(loadSecret())
	mint := func(sub, email, typ string) string {
		claims := jwt.MapClaims{
			"sub":          sub,
			"email":        email,
			"account_type": typ,
			"iat":          time.Now().Unix(),
			"exp":          time.Now().Add(50 * time.Minute).Unix(),
		}
		t, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
		if err != nil {
			fmt.Fprintln(os.Stderr, "mint:", err)
			os.Exit(1)
		}
		return t
	}
	out := map[string]string{
		// BUYER who owns order 9bfe4f32-bac3-4835-8db3-5b469e7d643c
		"BUYER": mint("ae2e7050-4bc6-407b-b670-98d82a215b9b", "johnsonimpoke@gmail.com", "BUYER"),
		// SELLER = gauthier bofi (owner of business 34f536ff = Bofi Pharma)
		"SELLER": mint("10f488ae-e546-407e-ad82-96efb18466c6", "bofigauthier3@gmail.com", "SELLER"),
	}
	b, _ := json.Marshal(out)
	fmt.Println(string(b))
}
