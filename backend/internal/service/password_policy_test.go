package service

import "testing"

func TestIsStrongPassword(t *testing.T) {
	tests := []struct {
		name, password string
		valid          bool
	}{
		{"valid", "Test123!", true},
		{"too short", "Te1!", false},
		{"too long", "Aa1!" + string(make([]byte, 61)), false},
		{"missing uppercase", "test123!", false},
		{"missing lowercase", "TEST123!", false},
		{"missing number", "Testing!", false},
		{"missing special", "Testing1", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsStrongPassword(tt.password); got != tt.valid {
				t.Fatalf("IsStrongPassword() = %v, want %v", got, tt.valid)
			}
		})
	}
}
