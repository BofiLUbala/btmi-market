package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

func main() {
	connStr := "host=localhost port=5432 user=btmi_user password=btmi_secret_password dbname=btmi_market sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()

	fmt.Println("=== COURIERS IN DB ===")
	rows, err := db.Query(`
		SELECT c.id, c.user_id, c.status, c.availability, u.email, u.first_name, u.last_name, u.account_type, u.status as user_status
		FROM couriers c
		JOIN users u ON c.user_id = u.id
	`)
	if err != nil {
		log.Fatalf("query couriers: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var cID, uID, cStatus, avail, email, fName, lName, accType, uStatus string
		if err := rows.Scan(&cID, &uID, &cStatus, &avail, &email, &fName, &lName, &accType, &uStatus); err != nil {
			log.Fatalf("scan courier: %v", err)
		}
		// Mask email for safety
		maskedEmail := email
		if len(email) > 4 {
			maskedEmail = email[:3] + "***@" + email[len(email)-8:]
		}

		// Check if employee profile exists
		var empCount int
		_ = db.QueryRow(`SELECT count(*) FROM employees WHERE linked_user_id = $1`, uID).Scan(&empCount)

		fmt.Printf("Courier ID: %s\n  User ID: %s\n  Masked Email: %s\n  Name: %s %s\n  User AccountType: %s\n  User Status: %s\n  Courier Status: %s\n  Availability: %s\n  Employee Profile Exists: %v\n\n",
			cID, uID, maskedEmail, fName, lName, accType, uStatus, cStatus, avail, empCount > 0)
	}

	fmt.Println("=== EMPLOYEES IN DB ===")
	empRows, err := db.Query(`
		SELECT e.id, e.business_id, e.linked_user_id, e.first_name, e.last_name, e.status, u.email, u.account_type
		FROM employees e
		LEFT JOIN users u ON e.linked_user_id = u.id
	`)
	if err != nil {
		log.Fatalf("query employees: %v", err)
	}
	defer empRows.Close()

	for empRows.Next() {
		var eID, bID, fName, lName, status string
		var linkedUID, email, accType sql.NullString
		if err := empRows.Scan(&eID, &bID, &linkedUID, &fName, &lName, &status, &email, &accType); err != nil {
			log.Fatalf("scan employee: %v", err)
		}
		fmt.Printf("Employee ID: %s\n  Linked User ID: %s\n  Name: %s %s\n  Status: %s\n  User AccountType: %s\n\n",
			eID, linkedUID.String, fName, lName, status, accType.String)
	}
}
