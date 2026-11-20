package utils

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type AppError struct {
	Status  int
	Code    string
	Message string
	Fields  map[string]string
}

func (e *AppError) Error() string {
	return e.Message
}

type APIErrorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

type ErrorResponse struct {
	Error APIErrorBody `json:"error"`
}

type SuccessResponse struct {
	Data interface{} `json:"data"`
	Meta interface{} `json:"meta,omitempty"`
}

// SendSuccess sends a standard JSON success response matching the frontend HTTP client envelope.
func SendSuccess(c *fiber.Ctx, status int, data interface{}) error {
	return c.Status(status).JSON(SuccessResponse{
		Data: data,
	})
}

// SendSuccessWithMeta sends a standard JSON success response with pagination/metadata.
func SendSuccessWithMeta(c *fiber.Ctx, status int, data interface{}, meta interface{}) error {
	return c.Status(status).JSON(SuccessResponse{
		Data: data,
		Meta: meta,
	})
}

// SendError sends a standard JSON error response with an optional per-field error map.
func SendError(c *fiber.Ctx, status int, code string, message string, fields map[string]string) error {
	return c.Status(status).JSON(ErrorResponse{
		Error: APIErrorBody{
			Code:    code,
			Message: message,
			Fields:  fields,
		},
	})
}

// ParseJSONBody strictly decodes a JSON request body, disallowing empty bodies, malformed syntax,
// type mismatches, unknown fields (anti-mass assignment), and trailing tokens.
func ParseJSONBody(c *fiber.Ctx, dst interface{}) *AppError {
	raw := c.Body()
	if len(bytes.TrimSpace(raw)) == 0 {
		return &AppError{
			Status:  fiber.StatusBadRequest,
			Code:    "EMPTY_REQUEST_BODY",
			Message: "Request body kosong. Kirim payload JSON yang valid.",
		}
	}

	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var synErr *json.SyntaxError
		if errors.As(err, &synErr) {
			return &AppError{
				Status:  fiber.StatusBadRequest,
				Code:    "INVALID_JSON_SYNTAX",
				Message: fmt.Sprintf("Format JSON tidak valid pada posisi byte %d. Periksa tanda kutip, koma, atau kurung kurawal.", synErr.Offset),
			}
		}

		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) {
			field := typeErr.Field
			if field == "" {
				field = "body"
			}
			return &AppError{
				Status:  fiber.StatusBadRequest,
				Code:    "INVALID_FIELD_TYPE",
				Message: fmt.Sprintf("Tipe data pada field '%s' tidak valid (diharapkan %s).", field, typeErr.Type.String()),
				Fields: map[string]string{
					field: fmt.Sprintf("Harus bertipe %s.", typeErr.Type.String()),
				},
			}
		}

		errMsg := err.Error()
		if strings.HasPrefix(errMsg, "json: unknown field ") {
			fieldName := strings.Trim(strings.TrimPrefix(errMsg, "json: unknown field "), "\"")
			return &AppError{
				Status:  fiber.StatusBadRequest,
				Code:    "UNKNOWN_FIELD",
				Message: fmt.Sprintf("Field tidak dikenal dalam payload JSON: '%s'.", fieldName),
				Fields: map[string]string{
					fieldName: "Field ini tidak diizinkan.",
				},
			}
		}

		if errors.Is(err, io.ErrUnexpectedEOF) {
			return &AppError{
				Status:  fiber.StatusBadRequest,
				Code:    "INVALID_JSON_SYNTAX",
				Message: "Format JSON terpotong atau tidak lengkap. Periksa tanda kutip, koma, dan penutup kurung kurawal.",
			}
		}

		if errors.Is(err, io.EOF) {
			return &AppError{
				Status:  fiber.StatusBadRequest,
				Code:    "EMPTY_REQUEST_BODY",
				Message: "Request body kosong. Kirim payload JSON yang valid.",
			}
		}

		return &AppError{
			Status:  fiber.StatusBadRequest,
			Code:    "INVALID_JSON_BODY",
			Message: "Payload JSON tidak dapat dibaca. Pastikan struktur JSON sesuai.",
		}
	}

	// Reject trailing data after the first valid JSON value.
	var extra interface{}
	if err := dec.Decode(&extra); err != io.EOF {
		return &AppError{
			Status:  fiber.StatusBadRequest,
			Code:    "INVALID_JSON_SYNTAX",
			Message: "Payload JSON hanya boleh berisi satu objek JSON yang valid tanpa karakter tambahan di belakangnya.",
		}
	}

	return nil
}

// ErrorHandler handles AppError, Fiber errors, and unexpected server errors with a detailed JSON envelope.
func ErrorHandler(c *fiber.Ctx, err error) error {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	var fiberErr *fiber.Error
	if errors.As(err, &fiberErr) {
		code, message := mapFiberError(c, fiberErr.Code, fiberErr.Message)
		return SendError(c, fiberErr.Code, code, message, nil)
	}

	log.Printf("Unhandled error on %s %s: %v", c.Method(), c.Path(), err)
	return SendError(
		c,
		fiber.StatusInternalServerError,
		"INTERNAL_SERVER_ERROR",
		"Terjadi kesalahan internal pada server saat memproses permintaan.",
		nil,
	)
}

func mapFiberError(c *fiber.Ctx, status int, fallbackMsg string) (string, string) {
	switch status {
	case fiber.StatusBadRequest:
		if fallbackMsg != "" {
			return "BAD_REQUEST", fallbackMsg
		}
		return "BAD_REQUEST", "Permintaan tidak valid."
	case fiber.StatusUnauthorized:
		return "UNAUTHORIZED", "Autentikasi diperlukan untuk mengakses resource ini."
	case fiber.StatusForbidden:
		return "FORBIDDEN", "Anda tidak memiliki izin untuk mengakses resource ini."
	case fiber.StatusNotFound:
		return "NOT_FOUND", fmt.Sprintf("Endpoint %s %s tidak ditemukan.", c.Method(), c.Path())
	case fiber.StatusMethodNotAllowed:
		return "METHOD_NOT_ALLOWED", fmt.Sprintf("Metode %s tidak diizinkan untuk endpoint %s.", c.Method(), c.Path())
	case fiber.StatusRequestEntityTooLarge:
		return "PAYLOAD_TOO_LARGE", "Ukuran payload request melebihi batas maksimal 6 MB."
	case fiber.StatusTooManyRequests:
		return "TOO_MANY_REQUESTS", "Terlalu banyak permintaan dalam waktu singkat. Tunggu beberapa saat sebelum mencoba lagi."
	default:
		if status >= 500 {
			return "INTERNAL_SERVER_ERROR", "Terjadi kesalahan internal pada server saat memproses permintaan."
		}
		if fallbackMsg != "" {
			return "REQUEST_ERROR", fallbackMsg
		}
		return "REQUEST_ERROR", "Permintaan gagal diproses."
	}
}
