package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"

	"github.com/joho/godotenv"
)

type AppConfig struct {
	AppEnv              string
	PortServer          string
	Timezone            string
	DBHost              string
	DBUser              string
	DBPassword          string `json:"-"`
	DBName              string
	DBPort              string
	DBSSLMode           string
	DBLogLevel          string
	CORSAllowedOrigins  string
	JWTSecret           string `json:"-"`
	JWTExpiryHours      int
	UploadDir           string
	MaxUploadSizeBytes  int64
	LoketLocation       string
	LoketSchedule       string
	PublicAppURL        string
	SMTPHost            string
	SMTPPort            int
	SMTPUser            string
	SMTPPassword        string `json:"-"`
	SMTPFrom            string
	SeedAdminPassword       string `json:"-"`
	SeedPetugasPassword     string `json:"-"`
	StaleThresholdDays      int
	StaleCheckIntervalHours int
}

var App *AppConfig

// LoadConfig loads configuration from environment variables/.env and validates required settings.
func LoadConfig() (*AppConfig, error) {
	if err := godotenv.Load(); err != nil {
		if errParent := godotenv.Load("../.env"); errParent != nil {
			log.Println("Info: .env file not found, reading from process environment")
		}
	}

	tz := getEnv("APP_TIMEZONE", "Asia/Jakarta")
	loc, err := time.LoadLocation(tz)
	if err != nil {
		log.Printf("Warning: failed to load timezone %q, falling back to WIB (UTC+7): %v", tz, err)
		loc = time.FixedZone("WIB", 7*3600)
	}
	time.Local = loc

	cfg := &AppConfig{
		AppEnv:              getEnv("APP_ENV", "development"),
		PortServer:          getEnv("PORT_SERVER", ":3001"),
		Timezone:            tz,
		DBHost:              os.Getenv("DB_HOST"),
		DBUser:              os.Getenv("DB_USER"),
		DBPassword:          os.Getenv("DB_PASSWORD"),
		DBName:              os.Getenv("DB_NAME"),
		DBPort:              os.Getenv("DB_PORT"),
		DBSSLMode:           getEnv("DB_SSLMODE", "disable"),
		DBLogLevel:          getEnv("DB_LOG_LEVEL", "warn"),
		CORSAllowedOrigins:  os.Getenv("CORS_ALLOWED_ORIGINS"),
		JWTSecret:           os.Getenv("JWT_SECRET"),
		JWTExpiryHours:      getEnvInt("JWT_EXPIRY_HOURS", 8),
		UploadDir:           getEnv("UPLOAD_DIR", "./storage/private"),
		MaxUploadSizeBytes:  getEnvInt64("MAX_UPLOAD_SIZE_BYTES", 2097152),
		LoketLocation:       os.Getenv("LOKET_LOCATION"),
		LoketSchedule:       os.Getenv("LOKET_SCHEDULE"),
		PublicAppURL:        os.Getenv("PUBLIC_APP_URL"),
		SMTPHost:            os.Getenv("SMTP_HOST"),
		SMTPPort:            getEnvInt("SMTP_PORT", 587),
		SMTPUser:            os.Getenv("SMTP_USER"),
		SMTPPassword:        os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:            os.Getenv("SMTP_FROM"),
		SeedAdminPassword:       os.Getenv("SEED_ADMIN_PASSWORD"),
		SeedPetugasPassword:     os.Getenv("SEED_PETUGAS_PASSWORD"),
		StaleThresholdDays:      getEnvInt("STALE_THRESHOLD_DAYS", 30),
		StaleCheckIntervalHours: getEnvInt("STALE_CHECK_INTERVAL_HOURS", 24),
	}

	if err := ValidateConfig(cfg); err != nil {
		return nil, err
	}

	if err := EnsureStorageDir(cfg.UploadDir); err != nil {
		log.Printf("Warning: failed to ensure upload directory %q: %v", cfg.UploadDir, err)
	}

	App = cfg
	return cfg, nil
}

// ValidateConfig checks that all mandatory environment variables are populated.
func ValidateConfig(cfg *AppConfig) error {
	if cfg == nil {
		return fmt.Errorf("configuration cannot be nil")
	}

	required := []struct {
		key string
		val string
	}{
		{"DB_HOST", cfg.DBHost},
		{"DB_USER", cfg.DBUser},
		{"DB_PASSWORD", cfg.DBPassword},
		{"DB_NAME", cfg.DBName},
		{"DB_PORT", cfg.DBPort},
		{"JWT_SECRET", cfg.JWTSecret},
	}

	var missing []string
	for _, item := range required {
		if strings.TrimSpace(item.val) == "" {
			missing = append(missing, item.key)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing required environment variables: %s", strings.Join(missing, ", "))
	}

	if strings.EqualFold(strings.TrimSpace(cfg.AppEnv), "production") {
		if len(strings.TrimSpace(cfg.JWTSecret)) < 32 {
			return fmt.Errorf("production hardening error: JWT_SECRET must be at least 32 characters")
		}
		corsVal := strings.TrimSpace(cfg.CORSAllowedOrigins)
		if corsVal == "" || corsVal == "*" || strings.Contains(corsVal, "*") {
			return fmt.Errorf("production hardening error: CORS_ALLOWED_ORIGINS must specify explicit origins without wildcard '*'")
		}
	}

	return nil
}

// EnsureStorageDir creates the private upload directory if it does not exist.
func EnsureStorageDir(dir string) error {
	return os.MkdirAll(dir, 0750)
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	val, ok := os.LookupEnv(key)
	if !ok || val == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvInt64(key string, fallback int64) int64 {
	val, ok := os.LookupEnv(key)
	if !ok || val == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
