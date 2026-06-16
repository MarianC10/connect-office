package users

import (
	"strings"
	"unicode/utf8"
)

func validateDisplayName(name string) error {
	trimmed := strings.TrimSpace(name)
	if utf8.RuneCountInString(trimmed) < 2 || utf8.RuneCountInString(trimmed) > 64 {
		return ErrInvalidDisplayName
	}
	return nil
}

func displayNameFromEmail(email string) string {
	local := strings.TrimSpace(strings.Split(email, "@")[0])
	if local == "" {
		return "User"
	}
	return local
}
