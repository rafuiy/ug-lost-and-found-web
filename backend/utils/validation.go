package utils

import (
	"crypto/subtle"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

var (
	npmRegex             = regexp.MustCompile(`^\d{8,15}$`)
	indonesianPhoneRegex = regexp.MustCompile(`^(\+62|62|0)8\d{7,12}$`)
)

// NormalizePhone removes spaces and hyphens from a phone number string.
func NormalizePhone(raw string) string {
	replacer := strings.NewReplacer(" ", "", "-", "")
	return replacer.Replace(strings.TrimSpace(raw))
}

// IsValidIndonesianPhone checks whether a normalized phone string is a valid Indonesian mobile number (<= 20 chars).
func IsValidIndonesianPhone(normalized string) bool {
	if len(normalized) == 0 || len(normalized) > 20 {
		return false
	}
	return indonesianPhoneRegex.MatchString(normalized)
}

// IsValidEmail checks basic length, RFC-style parsing, absence of whitespace, and domain dot presence.
func IsValidEmail(raw string) bool {
	trimmed := strings.TrimSpace(raw)
	if len(trimmed) == 0 || len(trimmed) > 100 || strings.ContainsAny(trimmed, " \t\r\n") {
		return false
	}
	addr, err := mail.ParseAddress(trimmed)
	if err != nil || addr.Address != trimmed {
		return false
	}
	parts := strings.Split(trimmed, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return false
	}
	domain := parts[1]
	if !strings.Contains(domain, ".") || strings.HasPrefix(domain, ".") || strings.HasSuffix(domain, ".") {
		return false
	}
	return true
}

// IsValidNPM checks that NPM contains 8 to 15 ASCII digits.
func IsValidNPM(raw string) bool {
	return npmRegex.MatchString(strings.TrimSpace(raw))
}

// ParsePastDateTime parses ISO-8601 / local datetime strings and ensures the timestamp is not in the future.
func ParsePastDateTime(raw string) (time.Time, *AppError) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return time.Time{}, &AppError{
			Status:  fiber.StatusUnprocessableEntity,
			Code:    "VALIDATION_ERROR",
			Message: "Tanggal dan waktu wajib diisi.",
		}
	}

	var parsed time.Time
	var err error

	for _, layout := range []string{time.RFC3339Nano, time.RFC3339} {
		parsed, err = time.Parse(layout, trimmed)
		if err == nil {
			break
		}
	}

	if err != nil {
		loc := time.Local
		if loc == nil {
			loc = time.FixedZone("WIB", 7*3600)
		}
		for _, layout := range []string{
			"2006-01-02T15:04:05",
			"2006-01-02T15:04",
			"2006-01-02 15:04:05",
			"2006-01-02 15:04",
		} {
			parsed, err = time.ParseInLocation(layout, trimmed, loc)
			if err == nil {
				break
			}
		}
	}

	if err != nil {
		return time.Time{}, &AppError{
			Status:  fiber.StatusUnprocessableEntity,
			Code:    "VALIDATION_ERROR",
			Message: "Format tanggal/waktu tidak valid. Gunakan format ISO-8601 (mis. 2026-11-20T14:30:00+07:00 atau 2026-11-20T14:30).",
		}
	}

	if parsed.After(time.Now().Add(time.Minute)) {
		return time.Time{}, &AppError{
			Status:  fiber.StatusUnprocessableEntity,
			Code:    "VALIDATION_ERROR",
			Message: "Waktu tidak boleh berada di masa depan.",
		}
	}

	return parsed, nil
}

// LastNDigits extracts ASCII digits from raw and returns the last n digits (or "" if fewer than n digits exist).
func LastNDigits(raw string, n int) string {
	if n <= 0 {
		return ""
	}
	var digits []byte
	for i := 0; i < len(raw); i++ {
		if raw[i] >= '0' && raw[i] <= '9' {
			digits = append(digits, raw[i])
		}
	}
	if len(digits) < n {
		return ""
	}
	return string(digits[len(digits)-n:])
}

// ConstantTimeEqual compares two non-empty strings in constant time.
func ConstantTimeEqual(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
