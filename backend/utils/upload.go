package utils

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type SavedPrivateFile struct {
	Filename string
	MIME     string
	Size     int64
}

type allowedMagicSpec struct {
	mime        string
	canonical   string
	allowedExts map[string]bool
}

var (
	specJPEG = allowedMagicSpec{
		mime:        "image/jpeg",
		canonical:   ".jpg",
		allowedExts: map[string]bool{".jpg": true, ".jpeg": true, "": true},
	}
	specPNG = allowedMagicSpec{
		mime:        "image/png",
		canonical:   ".png",
		allowedExts: map[string]bool{".png": true, "": true},
	}
	specPDF = allowedMagicSpec{
		mime:        "application/pdf",
		canonical:   ".pdf",
		allowedExts: map[string]bool{".pdf": true, "": true},
	}
)

// SavePrivateFile validates size, magic number, and extension consistency, then writes the file
// to the private storage directory using a random UUID filename.
func SavePrivateFile(fh *multipart.FileHeader, uploadDir string, maxBytes int64, fieldName string) (*SavedPrivateFile, *AppError) {
	if maxBytes <= 0 {
		maxBytes = 2097152
	}

	if fh == nil || fh.Size <= 0 {
		return nil, &AppError{
			Status:  fiber.StatusUnprocessableEntity,
			Code:    "EMPTY_FILE",
			Message: fmt.Sprintf("File pada field '%s' tidak boleh kosong.", fieldName),
			Fields: map[string]string{
				fieldName: "File wajib diisi dan tidak boleh kosong (0 byte).",
			},
		}
	}

	if fh.Size > maxBytes {
		return nil, &AppError{
			Status:  fiber.StatusRequestEntityTooLarge,
			Code:    "FILE_TOO_LARGE",
			Message: "Ukuran file melebihi batas maksimal 2 MB.",
			Fields: map[string]string{
				fieldName: "Ukuran file maksimal 2 MB.",
			},
		}
	}

	src, err := fh.Open()
	if err != nil {
		return nil, &AppError{
			Status:  fiber.StatusBadRequest,
			Code:    "FILE_READ_ERROR",
			Message: fmt.Sprintf("Gagal membaca file yang diunggah pada field '%s'.", fieldName),
			Fields: map[string]string{
				fieldName: "File tidak dapat dibuka.",
			},
		}
	}
	defer src.Close()

	data, err := io.ReadAll(io.LimitReader(src, maxBytes+1))
	if err != nil {
		return nil, &AppError{
			Status:  fiber.StatusBadRequest,
			Code:    "FILE_READ_ERROR",
			Message: fmt.Sprintf("Gagal membaca isi file pada field '%s'.", fieldName),
			Fields: map[string]string{
				fieldName: "Isi file tidak dapat dibaca.",
			},
		}
	}

	if len(data) == 0 {
		return nil, &AppError{
			Status:  fiber.StatusUnprocessableEntity,
			Code:    "EMPTY_FILE",
			Message: fmt.Sprintf("File pada field '%s' kosong (0 byte).", fieldName),
			Fields: map[string]string{
				fieldName: "File tidak boleh kosong.",
			},
		}
	}

	if int64(len(data)) > maxBytes {
		return nil, &AppError{
			Status:  fiber.StatusRequestEntityTooLarge,
			Code:    "FILE_TOO_LARGE",
			Message: "Ukuran file melebihi batas maksimal 2 MB.",
			Fields: map[string]string{
				fieldName: "Ukuran file maksimal 2 MB.",
			},
		}
	}

	spec, ok := detectAllowedMagic(data)
	if !ok {
		return nil, &AppError{
			Status:  fiber.StatusUnsupportedMediaType,
			Code:    "UNSUPPORTED_MEDIA_TYPE",
			Message: "Format file tidak didukung atau isi file rusak. Hanya file JPG, PNG, dan PDF asli yang diizinkan.",
			Fields: map[string]string{
				fieldName: "Format file harus JPG, PNG, atau PDF yang valid.",
			},
		}
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if !spec.allowedExts[ext] {
		return nil, &AppError{
			Status:  fiber.StatusUnsupportedMediaType,
			Code:    "MIME_MISMATCH",
			Message: "Ekstensi nama file tidak cocok dengan isi file sebenarnya. Unggah file JPG, PNG, atau PDF asli.",
			Fields: map[string]string{
				fieldName: fmt.Sprintf("Ekstensi '%s' tidak cocok dengan format %s.", ext, spec.mime),
			},
		}
	}

	if err := os.MkdirAll(uploadDir, 0750); err != nil {
		return nil, &AppError{
			Status:  fiber.StatusInternalServerError,
			Code:    "STORAGE_INIT_FAILED",
			Message: "Gagal menyiapkan direktori penyimpanan file privat di server.",
		}
	}

	safeName := uuid.NewString() + spec.canonical
	destPath := filepath.Join(uploadDir, safeName)
	if err := os.WriteFile(destPath, data, 0640); err != nil {
		return nil, &AppError{
			Status:  fiber.StatusInternalServerError,
			Code:    "FILE_SAVE_FAILED",
			Message: "Gagal menyimpan file ke penyimpanan privat server.",
		}
	}

	return &SavedPrivateFile{
		Filename: safeName,
		MIME:     spec.mime,
		Size:     int64(len(data)),
	}, nil
}

// RemovePrivateFile safely deletes a previously stored private file by basename (best-effort cleanup).
func RemovePrivateFile(uploadDir, filename string) {
	cleanName := filepath.Base(strings.TrimSpace(filename))
	if cleanName == "" || cleanName == "." || cleanName == string(filepath.Separator) {
		return
	}
	_ = os.Remove(filepath.Join(uploadDir, cleanName))
}

// ResolvePrivateFilePath safely resolves a stored UUID filename inside uploadDir and rejects any path traversal.
func ResolvePrivateFilePath(uploadDir, storedFilename string) (string, error) {
	trimmed := strings.TrimSpace(storedFilename)
	if trimmed == "" || trimmed == "." || trimmed == ".." {
		return "", fmt.Errorf("invalid stored filename")
	}
	if strings.ContainsAny(trimmed, "/\\") || strings.Contains(trimmed, "..") || filepath.Base(trimmed) != trimmed {
		return "", fmt.Errorf("path traversal detected in filename")
	}

	absDir, err := filepath.Abs(uploadDir)
	if err != nil {
		return "", fmt.Errorf("resolve upload dir: %w", err)
	}
	absFile, err := filepath.Abs(filepath.Join(absDir, trimmed))
	if err != nil {
		return "", fmt.Errorf("resolve private file path: %w", err)
	}

	if !strings.HasPrefix(absFile, absDir+string(filepath.Separator)) {
		return "", fmt.Errorf("resolved path escapes upload directory")
	}
	rel, err := filepath.Rel(absDir, absFile)
	if err != nil || rel == "." || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", fmt.Errorf("resolved relative path escapes upload directory")
	}

	return absFile, nil
}

func detectAllowedMagic(data []byte) (allowedMagicSpec, bool) {
	detected := http.DetectContentType(data)
	switch {
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF}) && detected == "image/jpeg":
		return specJPEG, true
	case bytes.HasPrefix(data, []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}) && detected == "image/png":
		return specPNG, true
	case bytes.HasPrefix(data, []byte("%PDF-")) && detected == "application/pdf":
		return specPDF, true
	default:
		return allowedMagicSpec{}, false
	}
}
