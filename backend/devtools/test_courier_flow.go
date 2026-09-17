package main

import (
	"database/sql"
	"fmt"
	"log"
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	connStr := "host=localhost port=5432 user=btmi_user password=btmi_secret_password dbname=btmi_market sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to db: %v", err)
	}
	defer db.Close()

	password := "Password123!"
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	email := "courier_f25b19a0@tbk.cd"
	res, err := db.Exec("UPDATE users SET password_hash = $1, status = 'ACTIVE', email_verified = true WHERE email = $2", string(hashed), email)
	if err != nil {
		log.Fatalf("Failed to update password: %v", err)
	}
	affected, _ := res.RowsAffected()
	fmt.Printf("Updated password for %s (rows affected: %d)\n", email, affected)

	// Now attempt login to backend API
	loginReq := map[string]string{
		"email":    email,
		"password": password,
	}
	bodyBytes, _ := json.Marshal(loginReq)
	resp, err := http.Post("http://localhost:8080/api/v1/auth/login", "application/json", bytes.NewBuffer(bodyBytes))
	if err != nil {
		log.Fatalf("Login POST failed: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	fmt.Printf("LOGIN STATUS: %d\n", resp.StatusCode)
	fmt.Printf("LOGIN RESPONSE: %s\n\n", string(respBody))

	if resp.StatusCode != 200 {
		return
	}

	var loginData struct {
		Data struct {
			AccessToken string `json:"access_token"`
			User        struct {
				ID           string `json:"id"`
				Email        string `json:"email"`
				AccountType  string `json:"account_type"`
				Capabilities struct {
					Courier  bool `json:"courier"`
					Employee bool `json:"employee"`
					Buyer    bool `json:"buyer"`
					Seller   bool `json:"seller"`
				} `json:"capabilities"`
			} `json:"user"`
		} `json:"data"`
		AccessToken string `json:"access_token"`
	}
	json.Unmarshal(respBody, &loginData)
	token := loginData.Data.AccessToken
	if token == "" {
		token = loginData.AccessToken
	}

	fmt.Printf("TOKEN: %s...\n", token[:20])

	// Test endpoints called by CourierDashboardPage.tsx
	endpoints := []struct {
		method  string
		path    string
		feature string
	}{
		{"GET", "/api/v1/courier/profile", "courier profile"},
		{"GET", "/api/v1/courier/missions", "assigned missions"},
		{"GET", "/api/v1/courier/history?limit=30", "history"},
		{"GET", "/api/v1/notifications?limit=50&offset=0", "notifications"},
		{"GET", "/api/v1/courier/dashboard", "dashboard summary"},
	}

	client := &http.Client{}
	for _, ep := range endpoints {
		req, _ := http.NewRequest(ep.method, "http://localhost:8080"+ep.path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		r, err := client.Do(req)
		if err != nil {
			fmt.Printf("FAIL %s %s: %v\n", ep.method, ep.path, err)
			continue
		}
		b, _ := io.ReadAll(r.Body)
		r.Body.Close()
		fmt.Printf("=== %s (%s) ===\nMETHOD: %s\nENDPOINT: %s\nSTATUS: %d\nRESPONSE: %s\n\n", ep.feature, ep.path, ep.method, ep.path, r.StatusCode, string(b))
	}
}
