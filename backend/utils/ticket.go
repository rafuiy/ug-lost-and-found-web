package utils

import (
	"crypto/rand"
	"encoding/hex"
	"math/big"
	"strings"
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

// GenerateResubmitToken creates a cryptographically secure 24-byte (48-hex-char) single-use token.
func GenerateResubmitToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// InferItemCategory maps item name and description to the standard UGLF item categories when not explicitly specified.
func InferItemCategory(itemName, itemDescription string) string {
	combined := strings.ToLower(strings.TrimSpace(itemName + " " + itemDescription))
	switch {
	case containsAnyKeyword(combined, "laptop", "macbook", "asus", "lenovo", "acer", "hp", "iphone", "samsung", "xiaomi", "handphone", "ponsel", "tws", "airpods", "earphone", "headset", "charger", "powerbank", "flashdisk", "harddisk", "ssd", "ipad", "tablet", "mouse", "keyboard", "kalkulator", "kamera"):
		return "Elektronik"
	case containsAnyKeyword(combined, "dompet", "wallet", "cardholder", "jam tangan", "kacamata", "gelang", "cincin", "kalung", "payung", "tumbler", "corkcicle", "botol"):
		return "Aksesoris / Dompet"
	case containsAnyKeyword(combined, "ktm", "ktp", "sim", "stnk", "atm", "kartu", "flazz", "emoney", "e-money", "brizzi", "tapcash", "paspor"):
		return "Identitas / Kartu"
	case containsAnyKeyword(combined, "kunci", "gantungan", "keychain", "remote motor", "keyless"):
		return "Kunci / Aksesoris"
	case containsAnyKeyword(combined, "tas", "ransel", "backpack", "totebag", "slingbag", "pouch", "jaket", "hoodie", "sweater", "topi", "helm", "sepatu"):
		return "Tas / Pakaian"
	case containsAnyKeyword(combined, "buku", "modul", "catatan", "binder", "map", "dokumen", "krs", "ijazah", "sertifikat", "skripsi", "alat tulis", "tempat pensil"):
		return "Dokumen / Buku"
	default:
		return "Lainnya"
	}
}

func containsAnyKeyword(text string, keywords ...string) bool {
	for _, kw := range keywords {
		if strings.Contains(text, kw) {
			return true
		}
	}
	return false
}

