package main

import (
	"os"

	"backend/config"
	"backend/models"
	"backend/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()

	app := fiber.New()

	// CORS middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: false,
	}))

	// Connect database
	config.ConnectDB()

	// Auto migrate models
	models.AutoMigrate(config.DB)

	// Setup routes
	routes.SetupRoutes(app)

	port := os.Getenv("PORT_SERVER")
	if port == "" {
		port = ":3001"
	}

	println("🚀 Server running at http://localhost" + port)
	app.Listen(port)
}
