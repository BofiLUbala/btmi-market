package email

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"

	"github.com/btmi-ai-market/backend/internal/config"
)

type Service struct {
	config *config.Config
}

func NewService(cfg *config.Config) *Service {
	return &Service{config: cfg}
}

func (s *Service) SendActivationEmail(to, activationURL string) error {
	if s.config.SMTPHost == "" || os.Getenv("E2E_TEST_MODE") == "true" {
		log.Printf("[DEV MODE] Activation URL for %s: %s", to, activationURL)
		return nil
	}

	subject := "Activate Your Account"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Activate Your Account</title>
</head>
<body>
    <h2>Welcome to BTMI Market!</h2>
    <p>Thank you for registering. Please click the link below to activate your account:</p>
    <p><a href="%s" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Activate Account</a></p>
    <p>Or copy and paste this link into your browser:</p>
    <p>%s</p>
    <p>This link will expire in 24 hours.</p>
    <p>If you did not create an account, please ignore this email.</p>
</body>
</html>
`, activationURL, activationURL)

	return s.sendEmail(to, subject, body)
}

func (s *Service) sendEmail(to, subject, htmlBody string) error {
	from := s.config.SMTPFrom
	auth := smtp.PlainAuth("", s.config.SMTPUser, s.config.SMTPPassword, s.config.SMTPHost)

	headers := make(map[string]string)
	headers["From"] = from
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlBody

	addr := fmt.Sprintf("%s:%s", s.config.SMTPHost, s.config.SMTPPort)
	return smtp.SendMail(addr, auth, from, []string{to}, []byte(message))
}

func (s *Service) BuildActivationURL(token string) string {
	return fmt.Sprintf("%s/activate-account?token=%s", strings.TrimRight(s.config.FrontendURL, "/"), token)
}

func (s *Service) BuildEmployeeInvitationURL(token string) string {
	return fmt.Sprintf("%s/employee/invite/accept?token=%s", strings.TrimRight(s.config.FrontendURL, "/"), token)
}

func (s *Service) BuildPasswordResetURL(token string) string {
	return fmt.Sprintf("%s/reset-password?token=%s", strings.TrimRight(s.config.FrontendURL, "/"), token)
}

func (s *Service) SendEmployeeInvitationEmail(to, firstName, invitationURL string) error {
	if s.config.SMTPHost == "" || os.Getenv("E2E_TEST_MODE") == "true" {
		log.Printf("[DEV MODE] Employee Invitation URL for %s (%s): %s", to, firstName, invitationURL)
		return nil
	}

	subject := "You're Invited to Join BTMI Market"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Employee Invitation</title>
</head>
<body>
    <h2>Hello %s,</h2>
    <p>You have been invited to join BTMI Market as an employee.</p>
    <p>Please click the link below to accept the invitation and create your account:</p>
    <p><a href="%s" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
    <p>Or copy and paste this link into your browser:</p>
    <p>%s</p>
    <p>This invitation will expire in 7 days.</p>
    <p>If you did not expect this invitation, please ignore this email.</p>
</body>
</html>
`, firstName, invitationURL, invitationURL)

	return s.sendEmail(to, subject, body)
}

func (s *Service) BuildAdminInvitationURL(token string) string {
	return fmt.Sprintf("%s/admin/activate?token=%s", strings.TrimRight(s.config.FrontendURL, "/"), token)
}

func (s *Service) SendAdminInvitationEmail(to, firstName, role, invitationURL string) error {
	if s.config.SMTPHost == "" || os.Getenv("E2E_TEST_MODE") == "true" {
		log.Printf("[DEV MODE] Admin Invitation URL for %s (%s, role=%s): %s", to, firstName, role, invitationURL)
		return nil
	}

	subject := "You're Invited to Join the BTMI Market Control Center"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Admin Invitation</title>
</head>
<body>
    <h2>Hello %s,</h2>
    <p>You have been invited to join the BTMI Market Control Center as <strong>%s</strong>.</p>
    <p>Please click the link below to activate your administrator account and set your password:</p>
    <p><a href="%s" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Activate Admin Account</a></p>
    <p>Or copy and paste this link into your browser:</p>
    <p>%s</p>
    <p>This invitation will expire in 7 days and can only be used once.</p>
    <p>If you did not expect this invitation, please ignore this email.</p>
</body>
</html>
`, firstName, role, invitationURL, invitationURL)

	return s.sendEmail(to, subject, body)
}

func (s *Service) SendPasswordResetEmail(to, resetURL string) error {
	if s.config.SMTPHost == "" || os.Getenv("E2E_TEST_MODE") == "true" {
		log.Printf("[DEV MODE] Password Reset URL for %s: %s", to, resetURL)
		return nil
	}

	subject := "Reset Your Password"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Reset Your Password</title>
</head>
<body>
    <h2>Password Reset Request</h2>
    <p>You requested to reset your password. Please click the link below to create a new password:</p>
    <p><a href="%s" style="background-color: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
    <p>Or copy and paste this link into your browser:</p>
    <p>%s</p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request a password reset, please ignore this email.</p>
</body>
</html>
`, resetURL, resetURL)

	return s.sendEmail(to, subject, body)
}
