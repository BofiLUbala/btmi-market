// Package tokenlib holds helpers shared by the local token dev tools.
package tokenlib

import (
	"fmt"
	"os"
	"strings"
)

// LoadSecret returns JWT_SECRET from the environment, else from ./.env.
func LoadSecret() string {
	if env := os.Getenv("JWT_SECRET"); env != "" {
		return env
	}
	raw, err := os.ReadFile(".env")
	if err != nil {
		fmt.Fprintln(os.Stderr, "read .env:", err)
		os.Exit(1)
	}
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "JWT_SECRET=") {
			return strings.Trim(line[len("JWT_SECRET="):], "\"'")
		}
	}
	fmt.Fprintln(os.Stderr, "JWT_SECRET missing in .env")
	os.Exit(1)
	return ""
}
