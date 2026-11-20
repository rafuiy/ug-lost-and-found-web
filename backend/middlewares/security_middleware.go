package middlewares

import (
	"fmt"
	"time"

	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// SecurityHeaders attaches baseline defensive HTTP response headers on every response.
func SecurityHeaders() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("Referrer-Policy", "no-referrer")
		c.Set("X-XSS-Protection", "0")
		c.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		return c.Next()
	}
}

// EndpointRateLimiter creates an IP-based rate limiter returning a structured JSON 429 response.
func EndpointRateLimiter(max int, window time.Duration, code string, message string) fiber.Handler {
	if max <= 0 {
		max = 10
	}
	if window <= 0 {
		window = time.Minute
	}

	return limiter.New(limiter.Config{
		Max:        max,
		Expiration: window,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return utils.SendError(
				c,
				fiber.StatusTooManyRequests,
				code,
				fmt.Sprintf("%s Silakan coba lagi setelah %s.", message, window),
				nil,
			)
		},
	})
}

// LoginRateLimiter restricts brute-force login attempts per client IP within the configured window.
func LoginRateLimiter(max int, window time.Duration) fiber.Handler {
	return EndpointRateLimiter(
		max,
		window,
		"LOGIN_RATE_LIMITED",
		"Terlalu banyak percobaan login.",
	)
}

// ReportSubmitRateLimiter limits public report submissions per client IP.
func ReportSubmitRateLimiter(max int, window time.Duration) fiber.Handler {
	return EndpointRateLimiter(
		max,
		window,
		"REPORT_SUBMIT_RATE_LIMITED",
		"Terlalu banyak pengiriman laporan dalam waktu singkat.",
	)
}

// ReportTrackRateLimiter limits public tracking verification attempts per client IP.
func ReportTrackRateLimiter(max int, window time.Duration) fiber.Handler {
	return EndpointRateLimiter(
		max,
		window,
		"TRACK_RATE_LIMITED",
		"Terlalu banyak percobaan pelacakan tiket.",
	)
}
