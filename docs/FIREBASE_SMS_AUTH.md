# Connexion et inscription par SMS (Firebase Phone Auth)

Le code n'est pas envoyé par notre serveur. Firebase envoie le SMS depuis
l'appareil et vérifie le code lui-même ; l'application nous transmet ensuite
l'**ID token** que Firebase lui remet, et le backend se contente de prouver que
ce jeton est authentique et d'en lire le numéro.

Conséquence : aucune passerelle SMS, aucun secret Firebase côté serveur. Le
backend ne connaît que l'identifiant du projet.

## Ce qui est déjà en place dans le code

**Backend**

| Fichier | Rôle |
|---|---|
| `internal/service/auth_firebase.go` | Vérifie l'ID token (RS256, certificats publics Google mis en cache), crée ou retrouve le compte, émet la session |
| `internal/handlers/auth/firebase_handler.go` | `GET /auth/sms/status`, `POST /auth/sms/signin`, `POST /auth/sms/forgot-password` |
| `internal/config/config.go` | `FIREBASE_PROJECT_ID` |

**Application**

| Fichier | Rôle |
|---|---|
| `src/lib/countryCodes.ts` | Indicatifs de tous les pays, conversion E.164 |
| `src/components/PhoneInput.tsx` | Champ téléphone avec sélecteur de pays recherchable |
| `src/lib/firebasePhone.ts` | Envoi et vérification du code par Firebase |
| `src/components/SmsAuth.tsx` | Saisie du code à 6 chiffres, renvoi, messages d'erreur |

Les écrans concernés sont `app/auth/login.tsx`, `app/auth/forgot-password.tsx`
et `src/components/RegisterFlow.tsx` (acheteur et vendeur).

## Ce qu'il reste à faire, une fois le projet Firebase créé

Le canal SMS reste **invisible** tant que ces quatre étapes ne sont pas faites.
C'est voulu : l'application fonctionne telle quelle, l'option apparaît le jour
où la configuration est complète.

### 1. Créer le projet Firebase

Console Firebase → nouveau projet → **Authentication** → onglet *Sign-in
method* → activer **Phone**.

Relever l'identifiant du projet dans *Paramètres du projet → Général →
ID du projet*.

### 2. Configurer le backend

```
FIREBASE_PROJECT_ID=votre-id-de-projet
```

Sans cette variable, `/auth/sms/status` répond `enabled: false` et les trois
routes refusent avec `SMS_UNAVAILABLE`.

### 3. Configurer l'application Android

Dans la console Firebase, ajouter une application Android avec le **même
package** que `android/app.json` (`android.package`), puis :

1. Télécharger `google-services.json` et le placer à la racine de `android/`.
2. Renseigner l'empreinte **SHA-256** de la clé de signature dans les
   paramètres de l'application Firebase. Avec EAS :
   `eas credentials` → Android → *Keystore* → relever le SHA-256.
   Sans cette empreinte, Play Integrity échoue et Firebase refuse l'envoi.
3. Installer les paquets natifs et déclarer le plugin :

```bash
npx expo install @react-native-firebase/app @react-native-firebase/auth
```

Puis dans `android/app.json`, ajouter aux `plugins` :

```json
["@react-native-firebase/app"]
```

et, à côté de `android.package` :

```json
"googleServicesFile": "./google-services.json"
```

4. Reconstruire : `npx expo prebuild --clean` puis `eas build`.

**Expo Go ne peut pas porter ce module.** Le canal SMS n'apparaît que dans un
development build ou une build de production ; ailleurs,
`isFirebasePhoneAvailable()` renvoie `false` et l'option reste masquée.

### 4. Tester

Firebase permet d'enregistrer des **numéros de test** avec un code fixe
(*Authentication → Sign-in method → Phone → Numéros de téléphone pour les
tests*). Ils ne consomment aucun SMS et contournent Play Integrity — c'est le
seul moyen fiable de tester sur émulateur.

## Coût et limites à connaître

- Firebase facture **par SMS**, selon le pays de destination, et exige le plan
  **Blaze**. L'Afrique est dans le haut du barème.
- Les 10 premiers SMS par jour sont gratuits ; au-delà, c'est facturé.
- La livraison vers certains opérateurs locaux reste imparfaite, quel que soit
  le fournisseur. Le canal WhatsApp existant (`OPENWA_*`) reste disponible en
  parallèle : les deux coexistent, et l'utilisateur choisit.

## Ce que fait le serveur avec le jeton

`SignInWithFirebasePhone` vérifie successivement : l'algorithme (RS256 seul),
l'identifiant de clé (seulement ceux publiés par Google), l'émetteur
(`https://securetoken.google.com/<projet>`), l'audience (`<projet>`),
l'expiration, puis l'existence d'un `sub` et d'un `phone_number`.

Le numéro vérifié vaut preuve de possession : il active un compte en attente et
marque le téléphone comme vérifié, exactement comme un code WhatsApp. Un numéro
que personne ne détient donne lieu à un compte sur-le-champ, si bien que
connexion et inscription sont la même requête — et que la réponse ne révèle
jamais si le compte existait déjà.

Pour le mot de passe oublié, `StartFirebasePasswordReset` renvoie un jeton de
réinitialisation valable 15 minutes, que l'écran passe à `/auth/reset-password`.
Un numéro inconnu reçoit le même `200` avec un jeton vide : impossible de
découvrir quels numéros sont enregistrés.
