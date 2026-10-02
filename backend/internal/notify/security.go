package notify

import (
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// DeviceRevoker stops push to all of a principal's devices (the push store).
type DeviceRevoker interface {
	RevokeAll(pr Principal, grace time.Duration, reason string)
}

// Security raises account security alerts. They cannot be switched off.
type Security struct {
	db       *database.DB
	notifier *Notifier
	devices  DeviceRevoker
}

func NewSecurity(db *database.DB, notifier *Notifier, devices DeviceRevoker) *Security {
	return &Security{db: db, notifier: notifier, devices: devices}
}

// knownDeviceWindow is how long a browser or phone stays "known" after its
// last sign-in.
const knownDeviceWindow = 90 * 24 * time.Hour

// DeviceSignature reduces a User-Agent to what identifies a device for the
// owner: the browser or app family and the operating system. Versions are
// left out, otherwise every browser update would look like a new device.
func DeviceSignature(ua string) string {
	l := strings.ToLower(ua)
	os := "appareil inconnu"
	switch {
	case strings.Contains(l, "android"):
		os = "Android"
	case strings.Contains(l, "iphone") || strings.Contains(l, "ipad"):
		os = "iOS"
	case strings.Contains(l, "windows"):
		os = "Windows"
	case strings.Contains(l, "mac os") || strings.Contains(l, "macintosh"):
		os = "macOS"
	case strings.Contains(l, "linux"):
		os = "Linux"
	}
	app := "navigateur"
	switch {
	case strings.Contains(l, "okhttp") || strings.Contains(l, "expo") || strings.Contains(l, "tbk-app"):
		app = "application TBK"
		if os == "appareil inconnu" {
			os = "mobile"
		}
	case strings.Contains(l, "edg/"):
		app = "Edge"
	case strings.Contains(l, "opr/") || strings.Contains(l, "opera"):
		app = "Opera"
	case strings.Contains(l, "samsungbrowser"):
		app = "Samsung Internet"
	case strings.Contains(l, "firefox"):
		app = "Firefox"
	case strings.Contains(l, "chrome") || strings.Contains(l, "crios"):
		app = "Chrome"
	case strings.Contains(l, "safari"):
		app = "Safari"
	}
	return app + " sur " + os
}

// kinshasa is the time zone the alerts are written in (WAT, UTC+1).
var kinshasa = func() *time.Location {
	if loc, err := time.LoadLocation("Africa/Kinshasa"); err == nil {
		return loc
	}
	return time.FixedZone("WAT", 3600)
}()

// userAudience picks the space where a user reads account alerts.
func (s *Security) userAudience(userID uuid.UUID) string {
	var accountType string
	var courier bool
	_ = s.db.QueryRow(`SELECT COALESCE(account_type::text, ''), EXISTS (SELECT 1 FROM couriers c WHERE c.user_id = u.id)
		FROM users u WHERE u.id = $1`, userID).Scan(&accountType, &courier)
	switch {
	case courier:
		return audCourier
	case accountType == "SELLER" || accountType == "EMPLOYEE":
		return audSeller
	}
	return audBuyer
}

// CheckNewLogin must run before the new session is stored. It warns the user
// when they sign in from a device not seen in 90 days; the very first sign-in
// of an account warns nobody.
func (s *Security) CheckNewLogin(userID uuid.UUID, userAgent string) {
	if s == nil {
		return
	}
	rows, err := s.db.Query(`SELECT DISTINCT user_agent FROM refresh_tokens
		WHERE user_id = $1 AND created_at > NOW() - make_interval(secs => $2) LIMIT 100`, userID, knownDeviceWindow.Seconds())
	if err != nil {
		return
	}
	signature := DeviceSignature(userAgent)
	seen, known := 0, false
	for rows.Next() {
		var ua string
		if rows.Scan(&ua) == nil {
			seen++
			if DeviceSignature(ua) == signature {
				known = true
			}
		}
	}
	rows.Close()
	if seen == 0 || known {
		return
	}
	when := time.Now().In(kinshasa).Format("02/01/2006 à 15:04")
	go s.notifier.ToUser(userID, s.userAudience(userID), Message{
		Type:  models.NotificationTypeNewLogin,
		Title: "Nouvelle connexion à votre compte",
		Body: fmt.Sprintf("Connexion depuis %s le %s. Si ce n'est pas vous, réinitialisez votre mot de passe sans attendre.",
			signature, when),
		RefType: RefAccount, RefID: userID,
		Meta: map[string]interface{}{"device": signature},
	})
}

// PasswordChanged warns the user, then stops push to their devices once the
// alert had time to arrive: whoever held an old session must not keep
// receiving the account's notifications.
func (s *Security) PasswordChanged(userID uuid.UUID) {
	if s == nil {
		return
	}
	s.notifier.ToUser(userID, s.userAudience(userID), Message{
		Type:    models.NotificationTypePasswordChanged,
		Title:   "Mot de passe modifié",
		Body:    "Le mot de passe de votre compte vient d'être changé et toutes vos sessions ont été fermées. Si ce n'est pas vous, contactez le support TBK.",
		RefType: RefAccount, RefID: userID,
	})
	if s.devices != nil {
		s.devices.RevokeAll(Principal{Kind: KindUser, ID: userID}, 5*time.Minute, "PASSWORD_CHANGED")
	}
}
