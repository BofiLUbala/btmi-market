# Diagnostic — Email de confirmation de compte (preuves réelles)
**Statut** : diagnostic confirmé par tests réels contre la stack Docker locale (`backend-api-1`, `backend-worker-1`, Postgres, Redis, vrai SMTP Gmail). En pause en attendant la fin de votre implémentation en parallèle (voir fichiers concurrents listés en fin de document).

## Root causes confirmés par test réel (pas seulement lecture de code)

### 1. Lien d'activation acheteur pointait vers la page vendeur — CONFIRMÉ, DÉJÀ CORRIGÉ (par les deux côtés en parallèle)
`backend/internal/email/email.go` → `BuildActivationURL(token)` construisait toujours `${FRONTEND_URL}/activate-account?token=...`, quel que soit le type de compte. Or dans `web-app/src/App.tsx` :
- `/activate` → `ActivatePage.tsx` (acheteur)
- `/activate-account` → `SellerActivatePage.tsx` (vendeur, alias de `/seller/activate`)

Un **acheteur** cliquant sur son lien de confirmation activait bien son compte côté backend (le token n'est pas lié au type de compte), mais atterrissait sur la page vendeur et était redirigé vers `/seller/onboarding` au lieu de `/account`. J'ai corrigé `BuildActivationURL` pour qu'elle prenne `accountType` en paramètre (`web-app`... pardon, `backend/internal/email/email.go`) — et j'ai constaté que votre édition parallèle de `auth_service.go` appelle déjà `BuildActivationURL(rawToken, user.AccountType)`, donc ma correction est nécessaire à la compilation de votre code et je l'ai laissée en place.

### 2. Envoi SMTP synchrone et lent — CONFIRMÉ PAR MESURE RÉELLE
Deux inscriptions réelles testées contre le vrai SMTP Gmail configuré (`smtp.gmail.com:587`, identifiants présents dans `backend/.env`, non affichés) :
- Test 1 : **12,26 s**
- Test 2 : **10,84 s**

`sendEmail`/`smtp.SendMail` s'exécute **de façon synchrone dans le handler HTTP** de `/auth/register` (confirmé : aucun type de job email dans `backend/internal/jobs/types.go`, le worker ne traite que du ranking/similarity — j'ai lu ses logs sur 10h d'activité, zéro mention d'email). Conséquence : si un load balancer/reverse proxy en production a un timeout plus court que ~11-12s (très courant : ALB par défaut 60s mais beaucoup de configs nginx/API gateway sont à 10-30s, et peuvent être plus stricts), le client peut recevoir une erreur de timeout **alors que le compte a été créé et l'email réellement envoyé** — un scénario qui correspond exactement au symptôme rapporté ("l'utilisateur ne reçoit rien de clair, mais la ligne existe en base").

### 3. Aucune limite de fréquence sur le renvoi — CONFIRMÉ PAR TEST RÉEL
6 appels `POST /auth/resend-activation` tirés à la suite pour le même compte → **6× HTTP 200**, chacun déclenchant un vrai envoi SMTP. Aucun throttling. Risque double : abus/spam d'une boîte cible, **et** risque de faire flaguer le compte Gmail expéditeur par Google pour comportement d'envoi anormal (ce qui dégraderait la délivrabilité de *tous* les emails suivants, y compris ceux de vrais utilisateurs).

### 4. Énumération de comptes via `/auth/resend-activation` — CONFIRMÉ PAR TEST RÉEL
- Email inexistant → `404 USER_NOT_FOUND`
- Email existant non vérifié → `200` (envoi réel)
- Email existant déjà actif → `409 ACCOUNT_ALREADY_ACTIVE`

Trois réponses distinctes permettent à quiconque de déterminer si une adresse est enregistrée et si elle est déjà activée.

### 5. Registration échoue en 500 si l'email échoue, sans rollback — CONFIRMÉ PAR LECTURE DE CODE
`registerWithAccountType` (avant votre édition en cours) : si `sendActivationEmail` retourne une erreur, la fonction retourne `nil, fmt.Errorf(...)`, mappé par le handler sur `500 INTERNAL_ERROR`. **L'utilisateur et le token sont déjà committés en base** à ce stade — aucun rollback. Le client voit un échec générique alors que le compte existe, non vérifiable par les moyens normaux (l'utilisateur ne sait pas qu'il doit utiliser "renvoyer l'email"). Votre nouvel endpoint `ReinitializeRegistration` (authentification par mot de passe) est une réponse pertinente à ce cas précis — à confirmer qu'il couvre bien le scénario "premier envoi échoué juste après inscription", pas seulement "je n'ai jamais reçu l'email des semaines après".

## Testé et confirmé PASS (comportement correct, ne pas casser)

| Test | Résultat |
|---|---|
| Création utilisateur → `PENDING_VERIFICATION`, `email_verified=false` | ✅ PASS |
| Expiration du token = 24h exactement | ✅ PASS (`23:59:59.999998` mesuré) |
| Activation avec token valide → statut `ACTIVE`, `email_verified=true`, session retournée | ✅ PASS |
| Réutilisation du même token → `409 ACTIVATION_LINK_ALREADY_USED` | ✅ PASS |
| Token invalide → `404 ACTIVATION_LINK_INVALID` | ✅ PASS |
| Token expiré (forcé en base) → `410 ACTIVATION_LINK_EXPIRED` | ✅ PASS |
| Login compte non vérifié → `403 ACCOUNT_NOT_ACTIVATED` | ✅ PASS |
| Login compte vérifié → `200` + tokens | ✅ PASS |
| Renvoi sur compte non vérifié → nouveau token, ancien invalidé | ✅ PASS |

## Autre constat, mineur
- Le conteneur `backend-api-1` tournait avec une **image construite avant le dernier commit** touchant l'auth (écart d'environ 4h) — j'ai dû reconstruire (`docker compose build api worker && docker compose up -d api worker`) pour tester le code actuel. **Si le déploiement AWS a le même écart "commit poussé mais jamais redéployé", c'est en soi une cause de confusion diagnostique** (on teste un comportement qui n'est plus dans le code).
- Mode Gin `debug` actif (pas `release`) — hygiène de prod, mineur.

## Ce qui reste hors de portée depuis cet environnement
- **Configuration AWS de production réelle** (variables d'env effectives, sécurité du groupe SMTP, timeout du load balancer/reverse proxy) — non accessible depuis ce poste. La checklist de variables à vérifier là-bas : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `FRONTEND_URL` (doit pointer vers le vrai domaine, pas `localhost`).
- **Boîte de réception réelle** — je n'ai pas accès à une boîte mail pour confirmer la délivrabilité finale (spam/SPF/DKIM/DMARC) ; seule l'acceptation par le serveur SMTP a été vérifiée (pas de bounce visible côté backend, mais bounce/spam se voient côté fournisseur, pas côté backend).
- **Utilisateurs non vérifiés existants en production** — la base locale n'en a qu'un seul (mon propre test). Requête sûre pour la vraie base de prod (lecture seule, ne mass-active rien) :
  ```sql
  SELECT count(*), min(created_at), max(created_at)
  FROM users WHERE status='PENDING_VERIFICATION' OR email_verified=false;
  ```

## Fichiers en cours d'édition en parallèle (constatés, non touchés par moi)
Backend : `cmd/api/main.go`, `internal/handlers/auth/handler.go`, `internal/service/auth_service.go`, `internal/models/user.go`, `internal/repository/activation_token_repository.go`, `internal/handlers/auth/handler_test.go` (nouveau), `migrations/056_create_auth_security_events.sql` (nouveau) — plus des fichiers admin/commandes sans rapport apparent (`admin/commerce_handler.go`, `order_service.go`, `order_lifecycle_test.go`).
Web : `App.tsx`, `api/auth.ts`, `api/types.ts`, `pages/auth/LoginPage.tsx`, `pages/auth/ReinitializeRegistrationPage.tsx` (nouveau), `locales/*`, `pages/checkout/DeliveryPage.tsx`.
Android : `app/_layout.tsx`, `app/auth/login.tsx`, `app/auth/registration-recovery.tsx` (nouveau), `app/checkout/delivery.tsx`, `src/api/index.ts`, `src/types.ts`, `src/locales/*`.

Fichier déjà modifié par moi (nécessaire à la compilation de votre `auth_service.go`, laissé en place) : `backend/internal/email/email.go`.
