package routes

import "github.com/gofiber/fiber/v2"

func SetupRoutes(app *fiber.App) {
	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
			"service": "uglf-backend",
		})
	})

	// API routes will be added here
	api := app.Group("/api")
	{
		v1 := api.Group("/v1")
		{
			// Auth routes
			// auth := v1.Group("/auth")
			// Users routes
			// users := v1.Group("/users")
		}
	}
}
