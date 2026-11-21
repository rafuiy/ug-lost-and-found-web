package services

import (
	"context"
	"errors"
	"log"
	"time"

	"backend/models"
	"backend/utils"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MarkStaleReports idempotently flags 'Belum Ada' reports older than thresholdDays as is_stale = true,
// using COALESCE(restored_at, created_at) so restored reports get a fresh active window, and writes
// system audit logs (admin_id = nil) for every flagged report.
func MarkStaleReports(db *gorm.DB, now time.Time, thresholdDays int) (int64, error) {
	if db == nil {
		return 0, errors.New("database connection is not initialized")
	}
	if thresholdDays <= 0 {
		thresholdDays = 30
	}
	if now.IsZero() {
		now = time.Now()
	}

	cutoff := now.AddDate(0, 0, -thresholdDays)
	var markedCount int64

	err := db.Transaction(func(tx *gorm.DB) error {
		var candidates []models.Report
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
			Where("status = ? AND is_stale = FALSE AND COALESCE(restored_at, created_at) < ?", models.ReportStatusBelumAda, cutoff).
			Find(&candidates).Error; err != nil {
			return err
		}

		if len(candidates) == 0 {
			return nil
		}

		ids := make([]uint, 0, len(candidates))
		for _, rep := range candidates {
			ids = append(ids, rep.ID)
		}

		if err := tx.Model(&models.Report{}).
			Where("id IN ?", ids).
			Updates(map[string]interface{}{
				"is_stale":   true,
				"updated_at": now,
			}).Error; err != nil {
			return err
		}

		for _, rep := range candidates {
			if err := utils.RecordAuditLog(
				tx,
				nil,
				"REPORT_MARKED_STALE",
				"reports",
				rep.ID,
				map[string]interface{}{
					"ticket_code":    rep.TicketCode,
					"threshold_days": thresholdDays,
					"trigger":        "DAILY_STALE_JOB",
				},
				"127.0.0.1",
			); err != nil {
				return err
			}
		}

		markedCount = int64(len(candidates))
		return nil
	})
	if err != nil {
		return 0, err
	}

	return markedCount, nil
}

// StartStaleScheduler executes MarkStaleReports once at startup and periodically on interval until ctx is canceled.
func StartStaleScheduler(ctx context.Context, db *gorm.DB, interval time.Duration, thresholdDays int) {
	if interval <= 0 {
		interval = 24 * time.Hour
	}
	if thresholdDays <= 0 {
		thresholdDays = 30
	}

	runOnce := func() {
		count, err := MarkStaleReports(db, time.Now(), thresholdDays)
		if err != nil {
			log.Printf("Warning: stale report job failed: %v", err)
			return
		}
		if count > 0 {
			log.Printf("Stale report job marked %d report(s) older than %d days as stale", count, thresholdDays)
		}
	}

	runOnce()

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runOnce()
			}
		}
	}()
}
