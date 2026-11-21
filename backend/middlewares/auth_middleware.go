package middlewares

import (
	"errors"
	"fmt"
	"strings"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const (
	LocalAdmin       = "auth_admin"
	LocalAdminID     = "auth_admin_id"
	LocalRole        = "auth_role"
	LocalRoleDisplay = "auth_role_display"
	LocalPermissions = "auth_permissions"
	LocalTokenJTI    = "auth_token_jti"
	LocalTokenExp    = "auth_token_exp"
)

// AuthMiddleware verifies Bearer JWT tokens, checks token revocation in PostgreSQL,
// loads the active admin + permissions from DB, and populates request locals.
func AuthMiddleware(cfg *config.AppConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if strings.TrimSpace(c.Query("token")) != "" {
			return utils.SendError(
				c,
				fiber.StatusUnauthorized,
				"TOKEN_IN_QUERY_FORBIDDEN",
				"Token autentikasi tidak boleh dikirim melalui query parameter URL. Gunakan header Authorization: Bearer <token>.",
				nil,
			)
		}

		authHeader := strings.TrimSpace(c.Get("Authorization"))
		if authHeader == "" {
			return utils.SendError(
				c,
				fiber.StatusUnauthorized,
				"MISSING_AUTH_HEADER",
				"Header Authorization wajib diisi dengan format: Bearer <token>.",
				nil,
			)
		}

		const bearerPrefix = "Bearer "
		if !strings.HasPrefix(authHeader, bearerPrefix) {
			return utils.SendError(
				c,
				fiber.StatusUnauthorized,
				"INVALID_AUTH_FORMAT",
				"Format header Authorization tidak valid. Gunakan format: Bearer <token>.",
				nil,
			)
		}

		tokenStr := strings.TrimSpace(strings.TrimPrefix(authHeader, bearerPrefix))
		if tokenStr == "" {
			return utils.SendError(
				c,
				fiber.StatusUnauthorized,
				"INVALID_AUTH_FORMAT",
				"Token Bearer pada header Authorization tidak boleh kosong. Gunakan format: Bearer <token>.",
				nil,
			)
		}

		claims, err := utils.ParseAccessToken(tokenStr, cfg)
		if err != nil {
			code, msg := mapJWTParseError(err)
			return utils.SendError(c, fiber.StatusUnauthorized, code, msg, nil)
		}

		if config.DB == nil {
			return utils.SendError(
				c,
				fiber.StatusInternalServerError,
				"AUTH_DB_ERROR",
				"Koneksi database autentikasi belum tersedia.",
				nil,
			)
		}

		var revokedCount int64
		if err := config.DB.Model(&models.RevokedToken{}).Where("jti = ?", claims.ID).Count(&revokedCount).Error; err != nil {
			return utils.SendError(
				c,
				fiber.StatusInternalServerError,
				"AUTH_DB_ERROR",
				"Gagal memverifikasi status sesi token di database.",
				nil,
			)
		}
		if revokedCount > 0 {
			return utils.SendError(
				c,
				fiber.StatusUnauthorized,
				"TOKEN_REVOKED",
				"Sesi autentikasi telah berakhir (logout). Silakan login kembali.",
				nil,
			)
		}

		adminID, ok := utils.ParseID(claims.AdminID)
		if !ok {
			return utils.SendError(
				c,
				fiber.StatusUnauthorized,
				"TOKEN_INVALID",
				"Klaim identitas admin di dalam token tidak valid.",
				nil,
			)
		}

		var admin models.Admin
		if err := config.DB.Preload("Role.Permissions").Where("id = ?", adminID).First(&admin).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return utils.SendError(
					c,
					fiber.StatusUnauthorized,
					"ADMIN_NOT_FOUND",
					"Akun pemilik token tidak ditemukan.",
					nil,
				)
			}
			return utils.SendError(
				c,
				fiber.StatusInternalServerError,
				"AUTH_DB_ERROR",
				"Gagal memuat profil akun autentikasi dari database.",
				nil,
			)
		}

		if !admin.IsActive {
			return utils.SendError(
				c,
				fiber.StatusForbidden,
				"ACCOUNT_INACTIVE",
				"Akun Anda dinonaktifkan. Hubungi Administrator.",
				nil,
			)
		}

		permSet := make(map[string]bool, len(admin.Role.Permissions))
		for _, p := range admin.Role.Permissions {
			permSet[p.Slug] = true
		}

		c.Locals(LocalAdmin, &admin)
		c.Locals(LocalAdminID, admin.ID)
		c.Locals(LocalRole, admin.Role.Name)
		c.Locals(LocalRoleDisplay, admin.Role.DisplayName)
		c.Locals(LocalPermissions, permSet)
		c.Locals(LocalTokenJTI, claims.ID)
		if claims.ExpiresAt != nil {
			c.Locals(LocalTokenExp, claims.ExpiresAt.Time)
		}

		return c.Next()
	}
}

// RequirePermission enforces that the authenticated user's role holds the required permission slug.
func RequirePermission(slug string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		permSet, ok := c.Locals(LocalPermissions).(map[string]bool)
		if !ok {
			return utils.SendError(
				c,
				fiber.StatusUnauthorized,
				"UNAUTHORIZED",
				"Sesi autentikasi tidak ditemukan. Silakan login terlebih dahulu.",
				nil,
			)
		}

		roleDisplay, _ := c.Locals(LocalRoleDisplay).(string)
		if roleDisplay == "" {
			roleDisplay, _ = c.Locals(LocalRole).(string)
		}

		if !permSet[slug] {
			return utils.SendError(
				c,
				fiber.StatusForbidden,
				"FORBIDDEN",
				fmt.Sprintf("Akses ditolak: role '%s' tidak memiliki izin '%s' untuk mengakses fitur ini.", roleDisplay, slug),
				nil,
			)
		}

		return c.Next()
	}
}

// RequireRole enforces that the authenticated user has one of the allowed role names.
func RequireRole(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals(LocalRole).(string)
		if !ok || role == "" {
			return utils.SendError(
				c,
				fiber.StatusUnauthorized,
				"UNAUTHORIZED",
				"Sesi autentikasi tidak ditemukan. Silakan login terlebih dahulu.",
				nil,
			)
		}

		for _, allowed := range allowedRoles {
			if role == allowed {
				return c.Next()
			}
		}

		return utils.SendError(
			c,
			fiber.StatusForbidden,
			"FORBIDDEN",
			fmt.Sprintf("Akses ditolak: fitur ini hanya dapat diakses oleh role: %s.", strings.Join(allowedRoles, ", ")),
			nil,
		)
	}
}

func mapJWTParseError(err error) (string, string) {
	switch {
	case errors.Is(err, utils.ErrTokenExpired):
		return "TOKEN_EXPIRED", "Token autentikasi sudah kedaluwarsa. Silakan login kembali."
	case errors.Is(err, utils.ErrInvalidSigningMethod):
		return "TOKEN_INVALID_ALGORITHM", "Algoritma signing token JWT tidak diizinkan."
	case errors.Is(err, utils.ErrTokenSignatureInvalid):
		return "TOKEN_SIGNATURE_INVALID", "Signature token JWT tidak valid atau telah dimodifikasi."
	case errors.Is(err, utils.ErrTokenWrongType):
		return "TOKEN_INVALID_TYPE", "Tipe token JWT tidak valid untuk akses API ini."
	case errors.Is(err, utils.ErrTokenMalformed):
		return "TOKEN_MALFORMED", "Format token JWT tidak valid atau rusak."
	default:
		return "TOKEN_INVALID", "Token autentikasi tidak valid."
	}
}
