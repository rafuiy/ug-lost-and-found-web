package utils

import (
	"strconv"
	"strings"
)

// ParseID parses a positive auto-increment primary key from a path/query/form value.
func ParseID(raw string) (uint, bool) {
	n, err := strconv.ParseUint(strings.TrimSpace(raw), 10, 64)
	if err != nil || n == 0 {
		return 0, false
	}
	return uint(n), true
}
