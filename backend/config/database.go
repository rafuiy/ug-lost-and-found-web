package config

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// ConnectDB opens a PostgreSQL connection via GORM, configures pooling, and verifies connectivity.
func ConnectDB(cfg *AppConfig) (*gorm.DB, error) {
	if cfg == nil {
		var err error
		cfg, err = LoadConfig()
		if err != nil {
			return nil, err
		}
	}

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
		cfg.DBHost,
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBName,
		cfg.DBPort,
		cfg.DBSSLMode,
		cfg.Timezone,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(parseDBLogLevel(cfg.DBLogLevel)),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(50)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	DB = db
	fmt.Println("Database connected successfully")
	return db, nil
}

// PingDB checks whether the global database connection is initialized and reachable.
func PingDB() error {
	if DB == nil {
		return errors.New("database connection is not initialized")
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}

func parseDBLogLevel(level string) logger.LogLevel {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "silent":
		return logger.Silent
	case "error":
		return logger.Error
	case "info":
		return logger.Info
	default:
		return logger.Warn
	}
}
