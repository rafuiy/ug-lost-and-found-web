package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/config"
	"backend/models"
	"backend/routes"
	"backend/seeders"
	"backend/services"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	db, err := config.ConnectDB(cfg)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}

	if err := models.AutoMigrate(db); err != nil {
		log.Fatalf("Auto migration failed: %v", err)
	}

	if err := seeders.SeedAll(db, cfg); err != nil {
		log.Fatalf("Database seeding failed: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	staleInterval := time.Duration(cfg.StaleCheckIntervalHours) * time.Hour
	services.StartStaleScheduler(ctx, db, staleInterval, cfg.StaleThresholdDays)

	app := routes.NewApp(cfg)
	listenErrCh := make(chan error, 1)
	go func() {
		log.Printf("Server running at http://localhost%s", cfg.PortServer)
		if err := app.Listen(cfg.PortServer); err != nil {
			listenErrCh <- err
		}
		close(listenErrCh)
	}()

	select {
	case err := <-listenErrCh:
		if err != nil {
			log.Fatalf("Server failed to start: %v", err)
		}
	case <-ctx.Done():
		log.Println("Shutdown signal received, stopping HTTP server...")
		if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
			log.Printf("Server forced shutdown error: %v", err)
		}
	}
}
