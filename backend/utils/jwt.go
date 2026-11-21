package utils

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"backend/config"
	"backend/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrTokenExpired          = errors.New("token has expired")
	ErrTokenMalformed        = errors.New("token is malformed")
	ErrTokenSignatureInvalid = errors.New("token signature is invalid")
	ErrInvalidSigningMethod  = errors.New("unexpected token signing method")
	ErrTokenWrongType        = errors.New("unexpected token type")
	ErrMissingJWTSecret      = errors.New("JWT secret is not configured")
)

type JWTClaims struct {
	AdminID     string   `json:"sub"`
	Username    string   `json:"username"`
	Email       string   `json:"email"`
	Name        string   `json:"name"`
	Role        string   `json:"role"`
	RoleDisplay string   `json:"role_display"`
	Permissions []string `json:"permissions"`
	TokenType   string   `json:"token_type"`
	jwt.RegisteredClaims
}

// GenerateAccessToken creates a signed HS256 JWT access token for an authenticated admin/petugas.
func GenerateAccessToken(admin *models.Admin, cfg *config.AppConfig) (string, string, time.Time, error) {
	if cfg == nil || strings.TrimSpace(cfg.JWTSecret) == "" {
		return "", "", time.Time{}, ErrMissingJWTSecret
	}
	if admin == nil {
		return "", "", time.Time{}, errors.New("admin record cannot be nil")
	}

	now := time.Now()
	expiryHours := cfg.JWTExpiryHours
	if expiryHours <= 0 {
		expiryHours = 8
	}
	expiresAt := now.Add(time.Duration(expiryHours) * time.Hour)
	jti := uuid.NewString()

	perms := make([]string, 0, len(admin.Role.Permissions))
	for _, p := range admin.Role.Permissions {
		perms = append(perms, p.Slug)
	}

	claims := JWTClaims{
		AdminID:     strconv.FormatUint(uint64(admin.ID), 10),
		Username:    admin.Username,
		Email:       admin.Email,
		Name:        admin.Name,
		Role:        admin.Role.Name,
		RoleDisplay: admin.Role.DisplayName,
		Permissions: perms,
		TokenType:   "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Issuer:    "uglf-backend",
			Subject:   strconv.FormatUint(uint64(admin.ID), 10),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("sign access token: %w", err)
	}

	return signed, jti, expiresAt, nil
}

// ParseAccessToken validates an HS256 JWT access token and returns its typed claims.
func ParseAccessToken(tokenString string, cfg *config.AppConfig) (*JWTClaims, error) {
	if cfg == nil || strings.TrimSpace(cfg.JWTSecret) == "" {
		return nil, ErrMissingJWTSecret
	}

	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		// Reject alg: none and any non-HS256 algorithm to prevent algorithm confusion attacks.
		if t.Method == nil || t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, ErrInvalidSigningMethod
		}
		return []byte(cfg.JWTSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))

	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidSigningMethod) || strings.Contains(err.Error(), "signing method"):
			return nil, ErrInvalidSigningMethod
		case errors.Is(err, jwt.ErrTokenExpired):
			return nil, ErrTokenExpired
		case errors.Is(err, jwt.ErrTokenSignatureInvalid):
			return nil, ErrTokenSignatureInvalid
		case errors.Is(err, jwt.ErrTokenMalformed):
			return nil, ErrTokenMalformed
		default:
			return nil, fmt.Errorf("%w: %v", ErrTokenMalformed, err)
		}
	}

	if !token.Valid {
		return nil, ErrTokenMalformed
	}

	if claims.TokenType != "access" {
		return nil, ErrTokenWrongType
	}
	if strings.TrimSpace(claims.AdminID) == "" {
		claims.AdminID = claims.Subject
	}
	if strings.TrimSpace(claims.ID) == "" || strings.TrimSpace(claims.AdminID) == "" {
		return nil, ErrTokenMalformed
	}

	return claims, nil
}
