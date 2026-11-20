package utils

import (
	"crypto/rand"
	"math/big"
)

const (
	ticketAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
	ticketLength   = 5
)

// GenerateTicketCode creates a random, non-sequential ticket code (e.g., "UG-7X9K2") using crypto/rand.
func GenerateTicketCode() (string, error) {
	maxIdx := big.NewInt(int64(len(ticketAlphabet)))
	buf := make([]byte, ticketLength)
	for i := 0; i < ticketLength; i++ {
		idx, err := rand.Int(rand.Reader, maxIdx)
		if err != nil {
			return "", err
		}
		buf[i] = ticketAlphabet[idx.Int64()]
	}
	return "UG-" + string(buf), nil
}
