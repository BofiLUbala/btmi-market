package config

import (
	"os"
	"strconv"
)

type Config struct {
	AppEnv            string
	APIPort           string
	WorkerEnabled     bool
	DBHost            string
	DBPort            string
	DBName            string
	DBUser            string
	DBPassword        string
	RedisAddr         string
	RedisPassword     string
	RedisDB           int
	JWTSecret         string
	AccessTokenTTL    int
	RefreshTokenTTL   int
	FrontendURL       string
	SMTPHost          string
	SMTPPort          string
	SMTPUser          string
	SMTPPassword      string
	SMTPFrom          string
}

func Load() *Config {
	return &Config{
		AppEnv:         getEnv("APP_ENV", "development"),
		APIPort:        getEnv("API_PORT", "8080"),
		WorkerEnabled:  getEnvBool("BACKGROUND_WORKER_ENABLED", false),
		DBHost:         getEnv("DB_HOST", "localhost"),
		DBPort:         getEnv("DB_PORT", "5432"),
		DBName:         getEnv("DB_NAME", "btmi_market"),
		DBUser:         getEnv("DB_USER", "btmi_user"),
		DBPassword:     getEnv("DB_PASSWORD", "btmi_secret_password"),
		RedisAddr:      getEnv("REDIS_ADDR", "redis:6379"),
		RedisPassword:  getEnv("REDIS_PASSWORD", ""),
		RedisDB:        getEnvInt("REDIS_DB", 0),
		JWTSecret:      getEnv("JWT_SECRET", "dev-secret-key-change-in-production"),
		AccessTokenTTL: getEnvInt("ACCESS_TOKEN_TTL", 15),
		RefreshTokenTTL: getEnvInt("REFRESH_TOKEN_TTL", 10080),
		FrontendURL:    getEnv("FRONTEND_URL", "http://localhost:3000"),
		SMTPHost:       getEnv("SMTP_HOST", ""),
		SMTPPort:       getEnv("SMTP_PORT", ""),
		SMTPUser:       getEnv("SMTP_USER", ""),
		SMTPPassword:   getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:       getEnv("SMTP_FROM", "noreply@btmi-market.com"),
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if val, ok := os.LookupEnv(key); ok {
		if b, err := strconv.ParseBool(val); err == nil {
			return b
		}
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}

func (c *Config) IsDevelopment() bool {
	return c.AppEnv == "development"
}
