package owner

import (
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

const maxLocationImageBytes = 5 << 20 // 5 MiB

var allowedImageMIMEs = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

func saveLocationImage(cfg Config, locationID uuid.UUID, imageID string, r io.Reader, contentType string) (string, error) {
	ext, ok := allowedImageMIMEs[contentType]
	if !ok {
		return "", fmt.Errorf("unsupported image type")
	}

	dir := filepath.Join(cfg.LocationUploadDir, locationID.String())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create location image dir: %w", err)
	}

	filename := imageID + ext
	path := filepath.Join(dir, filename)
	tmpPath := path + ".tmp"

	f, err := os.Create(tmpPath)
	if err != nil {
		return "", fmt.Errorf("create image file: %w", err)
	}

	written, copyErr := io.Copy(f, io.LimitReader(r, maxLocationImageBytes+1))
	closeErr := f.Close()
	if copyErr != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("write image: %w", copyErr)
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("close image: %w", closeErr)
	}
	if written > maxLocationImageBytes {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("image exceeds 5 MiB limit")
	}
	if written == 0 {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("empty image file")
	}

	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("finalize image: %w", err)
	}

	return cfg.StaticFilesBaseURL + "/locations/" + locationID.String() + "/" + filename, nil
}

func detectImageContentType(headerContentType string, peek []byte) string {
	ct := strings.TrimSpace(strings.Split(headerContentType, ";")[0])
	if ct != "" && allowedImageMIMEs[ct] != "" {
		return ct
	}
	detected := http.DetectContentType(peek)
	if allowedImageMIMEs[detected] != "" {
		return detected
	}
	if ext, err := mime.ExtensionsByType(detected); err == nil && len(ext) > 0 {
		for mimeType, extension := range allowedImageMIMEs {
			if extension == ext[0] {
				return mimeType
			}
		}
	}
	return ""
}
