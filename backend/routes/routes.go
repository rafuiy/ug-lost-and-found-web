package routes

import (
	"time"

	"backend/config"
	"backend/handlers"
	"backend/middlewares"
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"gorm.io/gorm"
)

type AppOptions struct {
	LoginRateLimitMax           int
	LoginRateLimitWindow        time.Duration
	ReportSubmitRateLimitMax    int
	ReportSubmitRateLimitWindow time.Duration
	ReportTrackRateLimitMax     int
	ReportTrackRateLimitWindow  time.Duration
	EmailSender                 services.EmailSender
	HandoverBeforeCommit        func(tx *gorm.DB) error
}

// NewApp builds a configured Fiber application instance shared by main and integration tests.
func NewApp(cfg *config.AppConfig, opts ...AppOptions) *fiber.App {
	opt := AppOptions{
		LoginRateLimitMax:           10,
		LoginRateLimitWindow:        time.Minute,
		ReportSubmitRateLimitMax:    10,
		ReportSubmitRateLimitWindow: time.Minute,
		ReportTrackRateLimitMax:     15,
		ReportTrackRateLimitWindow:  time.Minute,
	}
	if len(opts) > 0 {
		o := opts[0]
		if o.LoginRateLimitMax > 0 {
			opt.LoginRateLimitMax = o.LoginRateLimitMax
		}
		if o.LoginRateLimitWindow > 0 {
			opt.LoginRateLimitWindow = o.LoginRateLimitWindow
		}
		if o.ReportSubmitRateLimitMax > 0 {
			opt.ReportSubmitRateLimitMax = o.ReportSubmitRateLimitMax
		}
		if o.ReportSubmitRateLimitWindow > 0 {
			opt.ReportSubmitRateLimitWindow = o.ReportSubmitRateLimitWindow
		}
		if o.ReportTrackRateLimitMax > 0 {
			opt.ReportTrackRateLimitMax = o.ReportTrackRateLimitMax
		}
		if o.ReportTrackRateLimitWindow > 0 {
			opt.ReportTrackRateLimitWindow = o.ReportTrackRateLimitWindow
		}
		if o.EmailSender != nil {
			opt.EmailSender = o.EmailSender
		}
		if o.HandoverBeforeCommit != nil {
			opt.HandoverBeforeCommit = o.HandoverBeforeCommit
		}
	}
	if opt.EmailSender == nil {
		opt.EmailSender = services.NewSMTPEmailService(cfg)
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: utils.ErrorHandler,
		BodyLimit:    6 * 1024 * 1024, // Supports multipart submissions up to 2x 2MB files + form fields
	})

	app.Use(recover.New())
	app.Use(middlewares.SecurityHeaders())
	app.Use(logger.New(logger.Config{
		Format:   "${time} | ${status} | ${latency} | ${ip} | ${method} ${path}\n",
		TimeZone: cfg.Timezone,
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSAllowedOrigins,
		AllowMethods:     "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: false,
	}))

	SetupRoutes(app, cfg, opt)
	return app
}

// SetupRoutes configures health check, public report routes, auth endpoints, and protected admin routes.
// Unmatched routes fall through to Fiber's ErrorHandler (404 NOT_FOUND with detailed endpoint info).
func SetupRoutes(app *fiber.App, cfg *config.AppConfig, opt AppOptions) {
	app.Get("/health", handlers.HealthCheck)

	v1 := app.Group("/api/v1")

	authHandler := handlers.NewAuthHandler(cfg)
	auth := v1.Group("/auth")
	auth.Post("/login", middlewares.LoginRateLimiter(opt.LoginRateLimitMax, opt.LoginRateLimitWindow), authHandler.Login)
	auth.Get("/me", middlewares.AuthMiddleware(cfg), authHandler.Me)
	auth.Post("/logout", middlewares.AuthMiddleware(cfg), authHandler.Logout)

	// Public reporting & anti-IDOR tracking (no login required, no public inventory access)
	reportHandler := handlers.NewReportHandler(cfg, opt.EmailSender)
	v1.Post("/reports", middlewares.ReportSubmitRateLimiter(opt.ReportSubmitRateLimitMax, opt.ReportSubmitRateLimitWindow), reportHandler.SubmitReport)
	v1.Post("/reports/track", middlewares.ReportTrackRateLimiter(opt.ReportTrackRateLimitMax, opt.ReportTrackRateLimitWindow), reportHandler.TrackReport)
	v1.Get("/reports/reopen/:token", middlewares.ReportTrackRateLimiter(opt.ReportTrackRateLimitMax, opt.ReportTrackRateLimitWindow), reportHandler.ValidateReopenToken)

	// Protected admin endpoints (JWT + granular permission required)
	admin := v1.Group("/admin", middlewares.AuthMiddleware(cfg))

	invHandler := handlers.NewInventoryHandler()
	inventories := admin.Group("/inventories")
	inventories.Get("/", middlewares.RequirePermission("inventories.read"), invHandler.List)
	inventories.Post("/", middlewares.RequirePermission("inventories.write"), invHandler.Create)
	inventories.Get("/:id", middlewares.RequirePermission("inventories.read"), invHandler.GetByID)
	inventories.Patch("/:id", middlewares.RequirePermission("inventories.write"), invHandler.Update)
	inventories.Delete("/:id", middlewares.RequirePermission("inventories.write"), invHandler.Delete)

	adminReportHandler := handlers.NewAdminReportHandler(cfg, opt.EmailSender)
	reports := admin.Group("/reports")
	reports.Get("/", middlewares.RequirePermission("reports.read"), adminReportHandler.List)
	reports.Get("/:id", middlewares.RequirePermission("reports.read"), adminReportHandler.GetDetail)
	reports.Patch("/:id/status", middlewares.RequirePermission("reports.update_status"), adminReportHandler.UpdateStatus)
	reports.Patch("/:id/notes", middlewares.RequirePermission("reports.update_status"), adminReportHandler.UpdateNotes)
	reports.Post("/:id/restore", middlewares.RequirePermission("reports.restore"), adminReportHandler.Restore)
	reports.Get("/:id/files/:file_type", middlewares.RequirePermission("reports.view_files"), adminReportHandler.StreamPrivateFile)

	// Tahap 5: Atomic handover & immutable read-only audit logs
	handoverHandler := handlers.NewHandoverHandler(cfg, opt.HandoverBeforeCommit)
	admin.Post("/handovers", middlewares.RequirePermission("handovers.create"), handoverHandler.Create)

	auditLogHandler := handlers.NewAuditLogHandler()
	auditLogs := admin.Group("/audit-logs", middlewares.RequirePermission("audit_logs.read"))
	auditLogs.Get("/", auditLogHandler.List)
	auditLogs.Get("/:id", auditLogHandler.GetByID)
}
