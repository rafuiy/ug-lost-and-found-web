# UGLF Backend

Go backend service for UGLF project using Fiber web framework and Gorm ORM.

## Project Structure

```
backend/
├── config/          # Configuration (database connection)
├── handlers/        # HTTP request handlers
├── middlewares/     # Middleware functions (auth, CORS, etc)
├── models/          # Database models with auto migration
├── routes/          # Route definitions
├── seeders/         # Database seeders
├── tests/           # Unit tests
├── main.go          # Application entry point
├── go.mod           # Go module dependencies
└── .env.example     # Environment variables template
```

## Setup

### Prerequisites
- Go 1.23.3+
- PostgreSQL 12+

### Installation

1. Clone the repository
```bash
cd backend
```

2. Copy environment file
```bash
cp .env.example .env
```

3. Update `.env` with your database credentials
```env
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=uglf_db
DB_PORT=5432
PORT_SERVER=:3001
```

4. Install dependencies
```bash
go mod download
```

5. Run the application
```bash
go run main.go
```

The server will start at `http://localhost:3001`

## Database Migration

Models are auto-migrated on application startup. Current models:
- `User` - User accounts with roles
- `Role` - User roles (admin, user, guest)
- `Permission` - System permissions
- `AuditLog` - Activity audit logging

## Seeding

Database seeding runs automatically on startup:
```go
seeders.SeedAll(config.DB)
```

Includes default roles, permissions, and admin user.

## API Endpoints

Health check:
```
GET /health
```

User management (v1):
```
GET    /api/v1/users
GET    /api/v1/users/:id
POST   /api/v1/users
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id
```

## Dependencies

- **gofiber/fiber** - Web framework
- **gorm** - ORM for database operations
- **golang-jwt** - JWT authentication
- **godotenv** - Environment variable loading
- **golang.org/x/crypto** - Password hashing

## Contributing

Follow the existing project structure when adding:
- New models → `models/` directory
- New handlers → `handlers/` directory
- New routes → update `routes/routes.go`

## License

Internal project
