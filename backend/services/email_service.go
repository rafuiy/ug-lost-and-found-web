package services

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"
)

type EmailPayload struct {
	To         string
	Subject    string
	Body       string
	EventType  string
	TicketCode string
}

type EmailSender interface {
	Send(msg EmailPayload) error
	SendAsync(msg EmailPayload)
}

type SMTPEmailService struct {
	Cfg *config.AppConfig
}

func NewSMTPEmailService(cfg *config.AppConfig) *SMTPEmailService {
	return &SMTPEmailService{Cfg: cfg}
}

// Send delivers a transactional email via SMTP (or logs a dev fallback when SMTP_HOST is empty).
func (s *SMTPEmailService) Send(msg EmailPayload) error {
	to := stripCRLF(strings.TrimSpace(msg.To))
	if !utils.IsValidEmail(to) {
		return fmt.Errorf("invalid recipient email address")
	}

	if s == nil || s.Cfg == nil {
		return fmt.Errorf("email service configuration is nil")
	}

	if strings.TrimSpace(s.Cfg.SMTPHost) == "" {
		log.Printf("Email [dev-fallback] skipped SMTP (SMTP_HOST empty): event=%s ticket=%s to=%s", msg.EventType, msg.TicketCode, to)
		return nil
	}

	from := stripCRLF(strings.TrimSpace(s.Cfg.SMTPFrom))
	if from == "" {
		from = "no-reply@uglf.local"
	}
	subject := stripCRLF(msg.Subject)

	addr := net.JoinHostPort(s.Cfg.SMTPHost, strconv.Itoa(s.Cfg.SMTPPort))
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("smtp dial %s: %w", addr, err)
	}
	_ = conn.SetDeadline(time.Now().Add(20 * time.Second))

	client, err := smtp.NewClient(conn, s.Cfg.SMTPHost)
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("smtp client init: %w", err)
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsCfg := &tls.Config{
			ServerName: s.Cfg.SMTPHost,
			MinVersion: tls.VersionTLS12,
		}
		if err := client.StartTLS(tlsCfg); err != nil {
			return fmt.Errorf("smtp starttls: %w", err)
		}
	}

	if strings.TrimSpace(s.Cfg.SMTPUser) != "" {
		auth := smtp.PlainAuth("", s.Cfg.SMTPUser, s.Cfg.SMTPPassword, s.Cfg.SMTPHost)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}

	if err := client.Mail(from); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}

	wc, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data open: %w", err)
	}

	rawMsg := strings.Join([]string{
		"From: " + from,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		msg.Body,
	}, "\r\n")

	if _, err := wc.Write([]byte(rawMsg)); err != nil {
		_ = wc.Close()
		return fmt.Errorf("smtp write body: %w", err)
	}
	if err := wc.Close(); err != nil {
		return fmt.Errorf("smtp data close: %w", err)
	}

	if err := client.Quit(); err != nil {
		return fmt.Errorf("smtp quit: %w", err)
	}

	log.Printf("Email sent successfully: event=%s ticket=%s to=%s", msg.EventType, msg.TicketCode, to)
	return nil
}

// SendAsync dispatches email delivery in a background goroutine so SMTP delays or errors never block HTTP responses.
func (s *SMTPEmailService) SendAsync(msg EmailPayload) {
	go func() {
		if err := s.Send(msg); err != nil {
			log.Printf("Email async delivery failed: event=%s ticket=%s err=%v", msg.EventType, msg.TicketCode, err)
		}
	}()
}

// BuildReportConfirmationEmail builds the initial submission email containing ticket_code and tracking link.
// Never includes secret_traits or internal admin notes.
func BuildReportConfirmationEmail(cfg *config.AppConfig, report *models.Report) EmailPayload {
	trackingURL := "/track/" + report.TicketCode
	if cfg != nil && strings.TrimSpace(cfg.PublicAppURL) != "" {
		trackingURL = strings.TrimRight(strings.TrimSpace(cfg.PublicAppURL), "/") + "/track/" + report.TicketCode
	}

	body := fmt.Sprintf(
		"Halo %s,\n\n"+
			"Laporan kehilangan Anda untuk barang \"%s\" telah kami terima dengan status: Belum Ada.\n\n"+
			"Kode Tiket: %s\n"+
			"Tautan Pelacakan: %s\n"+
			"Kode Verifikasi: 4 digit terakhir NPM Anda\n\n"+
			"Simpan kode tiket ini untuk memantau perkembangan laporan. Kami akan mengirimkan email kembali apabila petugas menemukan kecocokan awal.\n\n"+
			"Salam,\n"+
			"UG Lost and Found — Universitas Gunadarma",
		report.ReporterName,
		report.ItemName,
		report.TicketCode,
		trackingURL,
	)

	return EmailPayload{
		To:         report.ReporterEmail,
		Subject:    fmt.Sprintf("[UG Lost & Found] Konfirmasi Laporan Kehilangan (%s)", report.TicketCode),
		Body:       body,
		EventType:  "report_confirmation",
		TicketCode: report.TicketCode,
	}
}

// BuildVerificationInvitationEmail builds the loket invitation email when status changes to 'Perlu Verifikasi'.
func BuildVerificationInvitationEmail(cfg *config.AppConfig, report *models.Report) EmailPayload {
	location := "Loket Lost and Found Universitas Gunadarma"
	schedule := "Jam layanan operasional loket"
	if cfg != nil {
		if strings.TrimSpace(cfg.LoketLocation) != "" {
			location = cfg.LoketLocation
		}
		if strings.TrimSpace(cfg.LoketSchedule) != "" {
			schedule = cfg.LoketSchedule
		}
	}

	body := fmt.Sprintf(
		"Halo %s,\n\n"+
			"Terdapat kecocokan awal untuk laporan kehilangan Anda (%s — %s).\n"+
			"Silakan datang langsung ke loket untuk verifikasi fisik dengan ketentuan berikut:\n\n"+
			"Lokasi Loket : %s\n"+
			"Jadwal       : %s\n"+
			"Dokumen Wajib: KTM asli (fotokopi atau foto di ponsel tidak diterima)\n\n"+
			"Catatan: Petugas loket tetap akan menanyakan ciri rahasia barang untuk memastikan kepemilikan sebelum serah terima dilakukan.\n\n"+
			"Salam,\n"+
			"UG Lost and Found — Universitas Gunadarma",
		report.ReporterName,
		report.TicketCode,
		report.ItemName,
		location,
		schedule,
	)

	return EmailPayload{
		To:         report.ReporterEmail,
		Subject:    fmt.Sprintf("[UG Lost & Found] Undangan Verifikasi Loket (%s)", report.TicketCode),
		Body:       body,
		EventType:  "verification_invitation",
		TicketCode: report.TicketCode,
	}
}

// BuildReportRejectionEmail builds the rejection email containing only the public rejection reason.
func BuildReportRejectionEmail(cfg *config.AppConfig, report *models.Report, publicReason string) EmailPayload {
	trackingURL := "/track/" + report.TicketCode
	if cfg != nil && strings.TrimSpace(cfg.PublicAppURL) != "" {
		trackingURL = strings.TrimRight(strings.TrimSpace(cfg.PublicAppURL), "/") + "/track/" + report.TicketCode
	}

	body := fmt.Sprintf(
		"Halo %s,\n\n"+
			"Laporan kehilangan Anda (%s — %s) tidak dapat kami lanjutkan dan berstatus: Ditolak.\n\n"+
			"Alasan Penolakan:\n%s\n\n"+
			"Anda tetap dapat memeriksa status melalui %s atau menghubungi petugas loket jika diperlukan.\n\n"+
			"Salam,\n"+
			"UG Lost and Found — Universitas Gunadarma",
		report.ReporterName,
		report.TicketCode,
		report.ItemName,
		publicReason,
		trackingURL,
	)

	return EmailPayload{
		To:         report.ReporterEmail,
		Subject:    fmt.Sprintf("[UG Lost & Found] Pembaruan Status Laporan (%s)", report.TicketCode),
		Body:       body,
		EventType:  "report_rejection",
		TicketCode: report.TicketCode,
	}
}

// BuildResubmitInvitationEmail builds the cancellation email for Ditolak -> Dibatalkan with a single-use resubmit link.
func BuildResubmitInvitationEmail(cfg *config.AppConfig, report *models.Report, cancelReason, resubmitURL string) EmailPayload {
	fullResubmitURL := resubmitURL
	if cfg != nil && strings.TrimSpace(cfg.PublicAppURL) != "" && strings.HasPrefix(resubmitURL, "/") {
		fullResubmitURL = strings.TrimRight(strings.TrimSpace(cfg.PublicAppURL), "/") + resubmitURL
	}

	body := fmt.Sprintf(
		"Halo %s,\n\n"+
			"Status penolakan pada laporan kehilangan Anda (%s — %s) telah dibatalkan oleh petugas loket dan kini berstatus: Dibatalkan.\n\n"+
			"Alasan Petugas:\n%s\n\n"+
			"Silakan ajukan ulang laporan kehilangan Anda melalui tautan khusus berikut (data dasar Anda akan terisi otomatis):\n"+
			"Ajukan Ulang Laporan: %s\n\n"+
			"Catatan: Tautan ini bersifat sekali pakai dan berlaku selama 7 hari.\n\n"+
			"Salam,\n"+
			"UG Lost and Found — Universitas Gunadarma",
		report.ReporterName,
		report.TicketCode,
		report.ItemName,
		cancelReason,
		fullResubmitURL,
	)

	return EmailPayload{
		To:         report.ReporterEmail,
		Subject:    fmt.Sprintf("[UG Lost & Found] Pembatalan Penolakan & Pengajuan Ulang (%s)", report.TicketCode),
		Body:       body,
		EventType:  "RESUBMIT_INVITATION",
		TicketCode: report.TicketCode,
	}
}

// BuildErrorClarificationEmail builds the official clarification email for Selesai -> Dibatalkan (voided handover).
func BuildErrorClarificationEmail(cfg *config.AppConfig, report *models.Report, cancelReason, resubmitURL string, inventoryRestored bool) EmailPayload {
	fullResubmitURL := resubmitURL
	if cfg != nil && strings.TrimSpace(cfg.PublicAppURL) != "" && strings.HasPrefix(resubmitURL, "/") {
		fullResubmitURL = strings.TrimRight(strings.TrimSpace(cfg.PublicAppURL), "/") + resubmitURL
	}

	invNote := "Silakan berkoordinasi dengan petugas Loket D untuk tindak lanjut verifikasi."
	if inventoryRestored {
		invNote = "Barang fisik terkait tercatat masih/kembali tersimpan di Loket D."
	}

	resubmitSection := ""
	if strings.TrimSpace(fullResubmitURL) != "" {
		resubmitSection = fmt.Sprintf(
			"\nApabila Anda perlu menerbitkan tiket laporan pengganti, silakan gunakan tautan sekali pakai berikut:\n"+
				"Ajukan Ulang Laporan: %s\n",
			fullResubmitURL,
		)
	}

	body := fmt.Sprintf(
		"Halo %s,\n\n"+
			"Kami menginformasikan bahwa status 'Selesai' pada tiket laporan %s (%s) telah dibatalkan menjadi 'Dibatalkan' karena koreksi operasional loket.\n\n"+
			"Alasan Koreksi Petugas:\n%s\n\n"+
			"Keterangan:\n%s\n%s\n"+
			"Salam,\n"+
			"UG Lost and Found — Universitas Gunadarma",
		report.ReporterName,
		report.TicketCode,
		report.ItemName,
		cancelReason,
		invNote,
		resubmitSection,
	)

	return EmailPayload{
		To:         report.ReporterEmail,
		Subject:    fmt.Sprintf("[UG Lost & Found] Pemberitahuan Koreksi Status Laporan (%s)", report.TicketCode),
		Body:       body,
		EventType:  "ERROR_CLARIFICATION",
		TicketCode: report.TicketCode,
	}
}

func stripCRLF(v string) string {
	return strings.NewReplacer("\r", "", "\n", "").Replace(v)
}
