package users

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

const maxAvatarBytes = 5 << 20 // 5 MiB

var allowedAvatarMIMEs = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

func saveAvatarFile(cfg Config, userID uuid.UUID, r io.Reader, contentType string) (string, error) {
	ext, ok := allowedAvatarMIMEs[contentType]
	if !ok {
		return "", fmt.Errorf("unsupported image type")
	}

	if err := os.MkdirAll(cfg.AvatarUploadDir, 0o755); err != nil {
		return "", fmt.Errorf("create avatar dir: %w", err)
	}

	filename := userID.String() + ext
	path := filepath.Join(cfg.AvatarUploadDir, filename)
	tmpPath := path + ".tmp"

	f, err := os.Create(tmpPath)
	if err != nil {
		return "", fmt.Errorf("create avatar file: %w", err)
	}

	written, copyErr := io.Copy(f, io.LimitReader(r, maxAvatarBytes+1))
	closeErr := f.Close()
	if copyErr != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("write avatar: %w", copyErr)
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("close avatar: %w", closeErr)
	}
	if written > maxAvatarBytes {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("avatar exceeds 5 MiB limit")
	}
	if written == 0 {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("empty avatar file")
	}

	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("finalize avatar: %w", err)
	}

	for _, otherExt := range []string{".jpg", ".png", ".webp"} {
		if otherExt == ext {
			continue
		}
		_ = os.Remove(filepath.Join(cfg.AvatarUploadDir, userID.String()+otherExt))
	}

	return cfg.StaticFilesBaseURL + "/avatars/" + filename, nil
}

func detectAvatarContentType(headerContentType string, peek []byte) string {
	ct := strings.TrimSpace(strings.Split(headerContentType, ";")[0])
	if ct != "" && allowedAvatarMIMEs[ct] != "" {
		return ct
	}
	detected := http.DetectContentType(peek)
	if allowedAvatarMIMEs[detected] != "" {
		return detected
	}
	if ext, err := mime.ExtensionsByType(detected); err == nil && len(ext) > 0 {
		for mimeType, extension := range allowedAvatarMIMEs {
			if extension == ext[0] {
				return mimeType
			}
		}
	}
	return ""
}
