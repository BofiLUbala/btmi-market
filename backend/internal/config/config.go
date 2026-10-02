package config

import (
	"os"
	"strconv"
)

type Config struct {
	AppEnv          string
	APIPort         string
	WorkerEnabled   bool
	DBHost          string
	DBPort          string
	DBName          string
	DBUser          string
	DBPassword      string
	RedisAddr       string
	RedisPassword   string
	RedisDB         int
	JWTSecret       string
	AccessTokenTTL  int
	RefreshTokenTTL int
	FrontendURL     string
	SMTPHost        string
	SMTPPort        string
	SMTPUser        string
	SMTPPassword    string
	SMTPFrom        string
	UploadDir       string
	VisualSearchURL string
	// Shared secret a payment provider signs its webhooks with. Empty means no
	// provider is wired up: the webhook then refuses every call rather than
	// trusting an unsigned one.
	PaymentWebhookSecret string
	// TomTom key for address search and road routes. Empty: points are placed
	// by hand or by coordinates only, and no route is computed.
	TomTomAPIKey string
	// OpenWA gateway (github.com/rmyndharis/OpenWA) used to send WhatsApp
	// one-time codes. Empty URL/key/session: WhatsApp sign-up and sign-in are
	// refused outside development, where the code is only logged.
	OpenWAURL                  string
	OpenWAAPIKey               string
	OpenWASessionID            string
	WhatsAppDefaultCountryCode string
	// Push notifications. Web push needs a VAPID key pair: when
	// VAPID_PRIVATE_KEY is empty one is generated once and kept in the
	// database. Mobile push goes through Expo's push service, which needs the
	// app's FCM credentials uploaded to EAS; EXPO_ACCESS_TOKEN is only
	// required when "enhanced push security" is on in the Expo project.
	PushEnabled     bool
	PushWebEnabled  bool
	PushExpoEnabled bool
	VAPIDPrivateKey string
	VAPIDSubject    string
	ExpoPushURL     string
	ExpoAccessToken string
	// Extra browser push hosts allowed as subscription endpoints (comma
	// separated), for a self-hosted push service or local tests.
	PushExtraHosts       string
	AppCommitSHA         string
	BuildTime            string
}

func Load() *Config {
	return &Config{
		AppEnv:               getEnv("APP_ENV", "development"),
		APIPort:              getEnv("API_PORT", "8080"),
		WorkerEnabled:        getEnvBool("BACKGROUND_WORKER_ENABLED", false),
		DBHost:               getEnv("DB_HOST", "localhost"),
		DBPort:               getEnv("DB_PORT", "5432"),
		DBName:               getEnv("DB_NAME", "btmi_market"),
		DBUser:               getEnv("DB_USER", "btmi_user"),
		DBPassword:           getEnv("DB_PASSWORD", "btmi_secret_password"),
		RedisAddr:            getEnv("REDIS_ADDR", "redis:6379"),
		RedisPassword:        getEnv("REDIS_PASSWORD", ""),
		RedisDB:              getEnvInt("REDIS_DB", 0),
		JWTSecret:            getEnv("JWT_SECRET", "dev-secret-key-change-in-production"),
		AccessTokenTTL:       getEnvInt("ACCESS_TOKEN_TTL", 15),
		RefreshTokenTTL:      getEnvInt("REFRESH_TOKEN_TTL", 10080),
		FrontendURL:          getEnv("FRONTEND_URL", "http://localhost:3000"),
		SMTPHost:             getEnv("SMTP_HOST", ""),
		SMTPPort:             getEnv("SMTP_PORT", ""),
		SMTPUser:             getEnv("SMTP_USER", ""),
		SMTPPassword:         getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:             getEnv("SMTP_FROM", "noreply@btmi-market.com"),
		UploadDir:            getEnv("UPLOAD_DIR", "./uploads"),
		VisualSearchURL:      getEnv("VISUAL_SEARCH_URL", "http://visual-search:8090"),
		PaymentWebhookSecret: getEnv("PAYMENT_WEBHOOK_SECRET", ""),
		TomTomAPIKey:         getEnv("TOMTOM_API_KEY", ""),
		OpenWAURL:            getEnv("OPENWA_URL", ""),
		OpenWAAPIKey:         getEnv("OPENWA_API_KEY", ""),
		OpenWASessionID:      getEnv("OPENWA_SESSION_ID", ""),
		WhatsAppDefaultCountryCode: getEnv("WHATSAPP_DEFAULT_COUNTRY_CODE", "243"),
		PushEnabled:          getEnvBool("PUSH_ENABLED", true),
		PushWebEnabled:       getEnvBool("PUSH_WEB_ENABLED", true),
		PushExpoEnabled:      getEnvBool("PUSH_EXPO_ENABLED", true),
		VAPIDPrivateKey:      getEnv("VAPID_PRIVATE_KEY", ""),
		VAPIDSubject:         getEnv("VAPID_SUBJECT", "mailto:support@tbkmarket.com"),
		ExpoPushURL:          getEnv("EXPO_PUSH_URL", ""),
		ExpoAccessToken:      getEnv("EXPO_ACCESS_TOKEN", ""),
		PushExtraHosts:       getEnv("PUSH_EXTRA_HOSTS", ""),
		AppCommitSHA:         getEnv("APP_COMMIT_SHA", "unknown"),
		BuildTime:            getEnv("BUILD_TIME", "unknown"),
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
