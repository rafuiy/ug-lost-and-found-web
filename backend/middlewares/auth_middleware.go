package middlewares

import (
	"github.com/gofiber/fiber/v2"
)

func AuthMiddleware(c *fiber.Ctx) error {
	// Extract token from Authorization header
	token := c.Get("Authorization")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "missing authorization token",
		})
	}

	// TODO: Validate JWT token

	return c.Next()
}

func AdminMiddleware(c *fiber.Ctx) error {
	// TODO: Check if user has admin role

	return c.Next()
}
