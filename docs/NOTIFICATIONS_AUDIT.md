# Notifications TBK — audit et catalogue des événements

Date : 2026-10-01. Ce document est la référence fonctionnelle ; la source
technique est `backend/internal/notify/catalog.go` (catégorie, priorité,
données sensibles) et `backend/internal/notify/links.go` (écran ouvert au clic).

## 1. Existant avant ce chantier

- Table `notifications` (in-app) écrite par `NotificationRepository.Create`,
  avec une audience (`BUYER`, `SELLER`, `COURIER`, `ADMIN`) dans `metadata`.
- Événements couverts : cycle de commande et de livraison
  (`CommunicationService.TriggerOrderEventNotification`) et messages du chat
  privé par commande (`notifyNewMessage`).
- Lecture par sondage (web, Android) + flux temps réel `tbk_order_events`
  (uniquement pour rafraîchir les commandes).
- **Aucune notification push**, aucune préférence, aucun consentement marketing,
  favoris stockés uniquement sur l'appareil (impossible de cibler une baisse de prix).

Défauts relevés pendant l'audit :

| # | Défaut | Effet | Correction |
|---|--------|-------|------------|
| D1 | Un livreur qui **refuse une mission** déclenche `ORDER_REJECTED` | L'acheteur reçoit « La boutique a refusé votre commande, le montant vous sera restitué » alors que la commande continue | Nouveaux types `COURIER_MISSION_ACCEPTED` / `COURIER_MISSION_REJECTED`, réservés aux admins |
| D2 | Un livreur qui **accepte une mission** déclenche `ORDER_ACCEPTED` | Second « Commande acceptée : la boutique a accepté… » envoyé à l'acheteur | Idem D1 |
| D3 | `COURIER_PICKED_UP` puis `DELIVERY_IN_TRANSIT` envoient deux fois le même texte à l'acheteur | Doublon | Acheteur prévenu au départ (`DELIVERY_IN_TRANSIT`), vendeur au ramassage (`COURIER_PICKED_UP`) |
| D4 | `DELIVERED` et `BUYER_RECEIPT_REQUIRED` partent ensemble vers l'acheteur | Doublon (le premier demande déjà la confirmation) | `BUYER_RECEIPT_REQUIRED` est absorbé s'il suit `DELIVERED` de moins de 10 min |
| D5 | Garde livreur web : redirection vers `/courier/login` (route inexistante) | Un livreur déconnecté qui ouvre un lien tombe sur une page 404 | Redirection vers `/livreur/login` qui renvoie ensuite vers l'écran demandé |
| D6 | `NEW_REVIEW`, `PAYMENT_CONFIRMED` définis mais jamais déclenchés | Vendeur jamais prévenu d'un avis, acheteur jamais prévenu d'un paiement validé | Raccordés |

## 2. Catégories, priorités, canaux

| Catégorie | Contenu | Push par défaut | Désactivable |
|-----------|---------|-----------------|--------------|
| `ORDERS` | Commandes, livraisons, missions livreur | oui | oui |
| `PAYMENTS` | Paiements, remboursements, points | oui | oui |
| `MESSAGES` | Messages du chat de commande | oui | oui |
| `SHOP` | Boutique, catalogue, stock, avis, équipe (vendeurs) | oui | oui |
| `ADMIN` | Alertes opérationnelles TBK (admins) | oui | oui |
| `SECURITY` | Connexion depuis un nouvel appareil, mot de passe, rôle admin | oui | **non** (toujours actif) |
| `WATCHLIST` | Baisse de prix / retour en stock d'un produit **suivi (favori)** | **non** | consentement explicite requis |
| `MARKETING` | Campagnes et offres TBK | **non** | consentement explicite requis |

Priorité :

- `HIGH` : push immédiat, urgence haute, canal Android « important ».
- `NORMAL` : push standard.
- `LOW` : **in-app uniquement**, pas de push (évite le bruit).

Fréquence : `WATCHLIST` ≤ 3 alertes / 24 h (au-delà, regroupement en un
résumé) ; `MARKETING` ≤ 1 / 24 h et ≤ 3 / 7 jours ; une baisse de prix n'est
signalée que si le prix descend d'au moins 5 % sous le dernier prix annoncé.

Données sensibles : le contenu d'un message de chat n'est **jamais** affiché
sur l'écran de verrouillage (push : « Nouveau message de … ») ; il reste lisible
dans l'application après connexion. Aucune notification ne contient de code de
remise, mot de passe, lien d'activation ou numéro de paiement.

## 3. Catalogue des événements

Légende destinataires : A = acheteur, V = équipe vendeur (membres actifs de
l'entreprise), L = livreur assigné, Ad = admins Commerce/Super, F = admins
Finance/Super, U = utilisateur concerné.

### 3.1 Commandes et livraison (opérationnel)

| Type | Déclencheur | Destinataires (priorité) | Écran au clic |
|------|-------------|--------------------------|---------------|
| `NEW_ORDER` | Commande créée (checkout) | V (HIGH), Ad (LOW) | V : `/seller/orders?order=` · Ad : fiche commande admin |
| `ORDER_ACTION_REMINDER` | Commande toujours `PENDING` après 15 min | V (HIGH) | commandes vendeur |
| `ORDER_STALLED` | Commande toujours `PENDING` après 60 min | Ad (NORMAL) | fiche commande admin |
| `ORDER_ACCEPTED` | Le vendeur accepte | A (NORMAL) | `/orders/:id` |
| `ORDER_REJECTED` | Le vendeur refuse | A (HIGH), Ad (NORMAL) | `/orders/:id` |
| `ORDER_PREPARING` | Préparation commencée | A (LOW) | `/orders/:id` |
| `ORDER_READY_FOR_PICKUP` | Commande prête | A (HIGH si retrait, LOW si livraison), Ad (HIGH, à assigner), L (NORMAL) | A : commande · Ad : assignations · L : mission |
| `COURIER_ASSIGNED` | Admin assigne un livreur | L (HIGH), A (NORMAL), V (NORMAL) | L : mission · A/V : commande |
| `COURIER_MISSION_ACCEPTED` | Le livreur accepte | Ad (LOW) | fiche commande admin |
| `COURIER_MISSION_REJECTED` | Le livreur refuse (motif) | Ad (HIGH) | assignations livreurs |
| `COURIER_PICKED_UP` | Colis récupéré chez le vendeur | V (NORMAL), Ad (LOW) | commande |
| `DELIVERY_IN_TRANSIT` | Le livreur part vers l'acheteur | A (NORMAL), Ad (LOW) | `/orders/:id/tracking` |
| `COURIER_ARRIVED` | Livreur arrivé | A (HIGH), Ad (LOW) | `/orders/:id` |
| `DELIVERED` | Colis remis | A (HIGH, confirmer la réception), V (NORMAL), Ad (LOW) | commande |
| `BUYER_RECEIPT_REQUIRED` | Remise scannée sans `DELIVERED` récent | A (HIGH) | `/orders/:id` |
| `BUYER_RECEIPT_REMINDER` | Livrée depuis 24 h, réception non confirmée | A (NORMAL) | `/orders/:id` |
| `ORDER_RECEIVED` | Réception confirmée par l'acheteur | V (NORMAL), A (LOW), Ad (LOW) | commande |
| `ORDER_COMPLETED` | Réception + paiement vérifiés | A (NORMAL, invite à noter), V (NORMAL), Ad (LOW) | A : `/orders/:id/review` |
| `ORDER_CANCELLED` | Annulation | A (HIGH), V (HIGH), Ad (NORMAL) | commande |
| `DELIVERY_FAILED` | Échec de livraison | A, V, Ad (HIGH) | commande |

### 3.2 Paiements

| Type | Déclencheur | Destinataires | Écran |
|------|-------------|---------------|-------|
| `PAYMENT_CONFIRMED` | Webhook opérateur : paiement réussi | A (NORMAL), V (NORMAL) | commande |
| `PAYMENT_FAILED` | Webhook opérateur : échec | A (HIGH) | `/checkout/payment?order=` → commande |
| `REFUND_ISSUED` | Remboursement d'une transaction vérifiée | A (NORMAL), V (HIGH), F (NORMAL) | commande |
| `POINTS_ADJUSTED` | Ajustement manuel des points par la Finance | A (NORMAL) | `/points/history` |

### 3.3 Messages

| Type | Déclencheur | Destinataires | Écran |
|------|-------------|---------------|-------|
| `NEW_MESSAGE` | Message privé sur une commande | uniquement la partie destinataire (A, V, L ou Ad) — HIGH, contenu masqué en push, regroupé par conversation | fil de la commande |

### 3.4 Boutique, catalogue, équipe (vendeur / livreur)

| Type | Déclencheur | Destinataires | Écran |
|------|-------------|---------------|-------|
| `SHOP_SUSPENDED` / `SHOP_REACTIVATED` | Admin change le statut d'une boutique (motif) | V propriétaires/admins (HIGH / NORMAL) | `/seller/shops` |
| `BUSINESS_SUSPENDED` / `BUSINESS_REACTIVATED` | Admin change le statut de l'entreprise | V (HIGH / NORMAL) | `/seller/business` |
| `PRODUCT_UNPUBLISHED` / `PRODUCT_ARCHIVED` | Modération admin (motif) | V (HIGH) | `/seller/products/:id` |
| `STOCK_OUT` | Une variante n'a plus de stock disponible dans une boutique (une fois par rupture) | V (NORMAL) | `/seller/products/:id` |
| `NEW_REVIEW` | Avis acheteur publié | V (NORMAL) | `/seller/reviews` |
| `REVIEW_REPLY` | Le vendeur répond à un avis | A auteur (NORMAL) | `/reviews` |
| `EMPLOYEE_JOINED` | Invitation employé acceptée | V propriétaires (NORMAL) | `/seller/employees` |
| `COURIER_SUSPENDED` / `COURIER_REACTIVATED` | Admin suspend / réactive un livreur | L (HIGH / NORMAL) | espace livreur |
| `COURIER_JOINED` | Invitation livreur acceptée | Ad (LOW) | `/admin/commerce/couriers` |
| `CASE_ASSIGNED` | Litige assigné à un admin | admin ciblé (HIGH) | `/admin/finance/cases` |

### 3.5 Sécurité du compte

| Type | Déclencheur | Destinataires | Écran |
|------|-------------|---------------|-------|
| `NEW_LOGIN` | Connexion depuis un navigateur/appareil jamais vu sur 90 jours (hors premier login) | U (HIGH, non désactivable) | paramètres de notification / compte |
| `PASSWORD_CHANGED` | Mot de passe réinitialisé | U (HIGH) ; les abonnements push de l'utilisateur sont révoqués 5 min après (le temps de livrer l'alerte) | compte |
| `ADMIN_ROLE_CHANGED` | Rôle d'un admin modifié | admin concerné (HIGH) | console admin |

### 3.6 Produits suivis et marketing (consentement explicite)

| Type | Déclencheur | Destinataires | Écran |
|------|-------------|---------------|-------|
| `PRICE_DROP` | Prix effectif d'un produit suivi en baisse ≥ 5 % (promotion ou nouveau prix) | A qui suit le produit et a activé « Produits suivis » | `/products/:id` (ou `/favorites` si résumé) |
| `BACK_IN_STOCK` | Produit suivi de nouveau disponible | idem | `/products/:id` |
| `MARKETING_CAMPAIGN` | Campagne envoyée par un admin Commerce | A ayant consenti au marketing, plafonné | lien interne choisi par l'admin |

Les favoris deviennent des « produits suivis » côté serveur dès que l'acheteur
est connecté (web et Android), ce qui permet le ciblage.

## 4. Événements volontairement non notifiés

- `ORDER_PREPARING`, `ORDER_RECEIVED` côté acheteur, et les suivis admin de
  routine : in-app seulement (LOW) pour éviter le bruit.
- `COURIER_NEAR_DESTINATION`, `DELIVERY_DELAYED`, `CASH_CONFIRMATION_REQUIRED` :
  types définis mais sans déclencheur métier fiable aujourd'hui (pas d'ETA
  calculée côté serveur, pas de flux d'encaissement séparé) — non raccordés.
- Litiges côté acheteur/vendeur : les dossiers sont un outil interne admin, il
  n'existe pas d'écran où l'acheteur suit un litige.
- Validation/refus de boutique : une boutique est active dès sa création, il
  n'y a pas d'étape de validation à notifier (seulement suspension/réactivation).
