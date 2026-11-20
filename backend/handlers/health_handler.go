package handlers

import (
	"backend/config"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

// HealthCheck verifies service liveliness and PostgreSQL database connectivity.
func HealthCheck(c *fiber.Ctx) error {
	if err := config.PingDB(); err != nil {
		return utils.SendError(
			c,
			fiber.StatusServiceUnavailable,
			"SERVICE_UNAVAILABLE",
			"Database tidak dapat dijangkau.",
			nil,
		)
	}

	return utils.SendSuccess(c, fiber.StatusOK, fiber.Map{
		"status":   "ok",
		"service":  "uglf-backend",
		"database": "connected",
	})
}
