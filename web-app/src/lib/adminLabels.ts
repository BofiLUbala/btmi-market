/**
 * Labels for the codes the API sends to the admin console (statuses,
 * roles, payment/delivery methods, audit actions, case/risk types…).
 *
 * The console is French-only; showing `CASH_ON_DELIVERY` or `UNDER_REVIEW` to an
 * operator is a bug. Unknown codes are humanised ("SOME_NEW_CODE" → "Some new
 * code") so a value the backend adds later never shows up raw.
 */
const LABELS: Record<string, string> = {
  // Generic statuses
  ACTIVE: 'Actif', INACTIVE: 'Inactif', PENDING: 'En attente', SUSPENDED: 'Suspendu', DISABLED: 'Désactivé',
  DEACTIVATED: 'Désactivé', ARCHIVED: 'Archivé', DRAFT: 'Brouillon', PUBLISHED: 'Publié', HIDDEN: 'Masqué',
  REMOVED: 'Retiré', DISCONTINUED: 'Arrêté', BLOCKED: 'Bloqué', TERMINATED: 'Terminé', EXPIRED: 'Expiré',
  REVOKED: 'Révoqué', OPEN: 'Ouvert', CLOSED: 'Fermé', RESOLVED: 'Résolu', DISMISSED: 'Classé sans suite',
  UNDER_REVIEW: 'En examen', WAITING_FOR_ADMIN: 'En attente d’un admin', WAITING: 'En attente', NEW: 'Nouveau',
  APPROVED: 'Approuvé', REJECTED: 'Rejeté', ACKNOWLEDGED: 'Pris en compte', IGNORED: 'Ignoré', APPLIED: 'Appliqué',
  QUEUED: 'En file', PROCESSING: 'En cours', SUCCEEDED: 'Réussi', FAILED: 'Échoué', COMPLETED: 'Terminé',
  CONFIRMED: 'Confirmé', VERIFIED: 'Vérifié', VALID: 'Valide', UNKNOWN: 'Inconnu', AVAILABLE: 'Disponible',
  UNAVAILABLE: 'Indisponible', BUSY: 'Occupé', PENDING_REVIEW: 'En attente de revue', PENDING_VERIFICATION: 'Vérification en attente',
  // Health / technical
  HEALTHY: 'Opérationnel', OK: 'OK', DEGRADED: 'Dégradé', DOWN: 'Hors service', CRITICAL: 'Critique', WARNING: 'Avertissement',
  INFO: 'Info', HIGH: 'Élevé', MEDIUM: 'Moyen', LOW: 'Faible', UP_TO_DATE: 'À jour', OUTDATED: 'Obsolète',
  NOT_DEPLOYED: 'Non déployé', NOT_CONFIGURED: 'Non configuré', CONFIGURED: 'Configuré', RUNNING: 'En marche', STOPPED: 'Arrêté',
  // Orders
  ACCEPTED: 'Acceptée', PREPARING: 'En préparation', READY: 'Prête', READY_FOR_PICKUP: 'Prête pour retrait',
  OUT_FOR_DELIVERY: 'En livraison', DELIVERED: 'Livrée', RECEIVED: 'Reçue', CANCELLED: 'Annulée', REFUNDED: 'Remboursée',
  AWAITING_PAYMENT: 'Paiement attendu', AWAITING_BUYER_CONFIRMATION: 'Confirmation acheteur attendue', HANDED_TO_PARTNER: 'Remise au partenaire',
  // Delivery
  PENDING_TBK_ASSIGNMENT: 'En attente d’un livreur', COURIER_ASSIGNED: 'Livreur assigné', COURIER_ACCEPTED: 'Livreur a accepté',
  COURIER_REJECTED: 'Livreur a refusé', COURIER_EN_ROUTE_TO_SHOP: 'Livreur en route vers la boutique', PICKED_UP: 'Récupérée',
  COURIER_PICKED_UP: 'Récupérée', IN_TRANSIT: 'En transit', COURIER_EN_ROUTE_TO_BUYER: 'En route vers l’acheteur',
  COURIER_NEAR_DESTINATION: 'Livreur proche', COURIER_ARRIVED: 'Livreur arrivé', DELIVERY_SCAN_SUCCESS: 'Remise scannée',
  RETURNING_TO_SELLER: 'Retour vers le vendeur', RETURNED_TO_SELLER: 'Retournée au vendeur', DELIVERY_FAILED: 'Livraison échouée',
  DELIVERY_DELAYED: 'Livraison retardée', DELIVERY_ASSIGNED: 'Livraison assignée', DELIVERY_IN_TRANSIT: 'Livraison en cours',
  DELIVERY_PENDING_ASSIGNMENT: 'Livraison à assigner', BUYER_NOT_FOUND: 'Acheteur introuvable',
  // Delivery methods
  TBK_STANDARD: 'Livraison TBK', TBK_DELIVERY: 'Livraison TBK', TBK: 'TBK', PICKUP: 'Retrait en boutique',
  SHOP_DELIVERY: 'Livraison boutique', LIVRAISON_BOUTIQUE: 'Livraison boutique', PARTNER: 'Partenaire de livraison',
  // Payments
  CASH_ON_DELIVERY: 'Espèces à la livraison', MOBILE_AT_DELIVERY: 'Paiement mobile à la livraison', MOBILE_PAY_NOW: 'Paiement mobile immédiat',
  CASH: 'Espèces', MOBILE: 'Mobile', ONLINE: 'En ligne', MPESA: 'M-Pesa', ORANGE_MONEY: 'Orange Money', AIRTEL_MONEY: 'Airtel Money',
  DUE: 'À payer', PAID: 'Payé', WAIVED: 'Annulé (remise)', COLLECTED: 'Encaissé', RECONCILED: 'Rapproché',
  CASH_COLLECTED: 'Espèces encaissées', CASH_CONFIRMATION_REQUIRED: 'Confirmation espèces requise', PAYMENT_INITIATED: 'Paiement initié',
  PAYMENT_CONFIRMED: 'Paiement confirmé', PAYMENT_VERIFIED: 'Paiement vérifié', PAYMENT_FAILED: 'Paiement échoué',
  METHOD_SELECTED: 'Moyen choisi', PROVIDER_SELECTED: 'Opérateur choisi', WEBHOOK_RECEIVED: 'Notification opérateur reçue',
  COMMISSION_COMPUTED: 'Commission calculée', NOW: 'Immédiat', DELIVERY: 'À la livraison', NONE: 'Aucune', PERCENTAGE: 'Pourcentage', FIXED: 'Montant fixe',
  // Admin roles & actors
  SUPER_ADMIN: 'Super admin', DIRECTION_ADMIN: 'Admin direction', COMMERCE_ADMIN: 'Admin commerce',
  FINANCE_SUPPORT_ADMIN: 'Admin finance & support', TECHNICAL_ADMIN: 'Admin technique', ADMIN: 'Admin', ADMIN_USER: 'Administrateur',
  BUYER: 'Acheteur', SELLER: 'Vendeur', SELLER_OWNER: 'Vendeur (propriétaire)', EMPLOYEE: 'Employé', MANAGER: 'Gérant', OWNER: 'Propriétaire',
  COURIER: 'Livreur', SYSTEM: 'Système', USER: 'Utilisateur',
  // Shops / businesses / categories
  PHYSICAL: 'Boutique physique', RETAIL: 'Commerce de détail', WHOLESALE: 'Grossiste', SERVICES: 'Services', MANUFACTURING: 'Fabrication',
  COMMERCE: 'Commerce', FINANCE: 'Finance', TECHNICAL: 'Technique', GENERAL: 'Général', DIRECTION: 'Direction',
  // Stock
  IN_STOCK: 'En stock', LOW_STOCK: 'Stock faible', OUT_OF_STOCK: 'Rupture', STOCK_IN: 'Entrée de stock', SALE: 'Vente',
  SALE_ONLINE: 'Vente en ligne', SALE_PHYSICAL: 'Vente en boutique', ADJUSTMENT: 'Ajustement', RETURN: 'Retour', TRANSFER_IN: 'Transfert entrant',
  TRANSFER_OUT: 'Transfert sortant', INITIAL: 'Stock initial', RESERVED: 'Réservé', ESCROW: 'Séquestre',
  // Cases & risk
  PAYMENT_DISPUTE: 'Litige de paiement', DELIVERY_ISSUE: 'Problème de livraison', PRODUCT_ISSUE: 'Problème produit',
  REFUND_REQUEST: 'Demande de remboursement', FRAUD: 'Fraude', OTHER: 'Autre', ORDER_STUCK: 'Commande bloquée', STUCK_ORDER: 'Commande bloquée',
  SELLER_CANCELLATIONS: 'Annulations vendeur', HIGH_CANCELLATION_RATE: 'Taux d’annulation élevé', PAYMENT_ANOMALY: 'Anomalie de paiement',
  // Security
  ADMIN_LOGIN_SUCCESS: 'Connexion admin réussie', ADMIN_LOGIN_FAILED: 'Échec de connexion admin', ADMIN_BRUTE_FORCE_SUSPECTED: 'Suspicion de force brute',
  // Worker errors
  PAYMENT_NOT_FOUND: 'Paiement introuvable', PAYMENT_NOT_VERIFIED: 'Paiement non vérifié',
  // Audit actions
  SHOP_STATUS_SUSPENDED: 'Boutique suspendue', SHOP_STATUS_ACTIVE: 'Boutique réactivée', BUSINESS_STATUS_ACTIVE: 'Entreprise réactivée',
  BUSINESS_STATUS_SUSPENDED: 'Entreprise suspendue', MAINTENANCE_UPDATE: 'Maintenance modifiée', CATEGORY_UPDATE: 'Catégorie modifiée',
  CATEGORY_CREATE: 'Catégorie créée', SUBCATEGORY_UPDATE: 'Sous-catégorie modifiée', SUBCATEGORY_CREATE: 'Sous-catégorie créée',
  GLOBAL_CONFIG_UPDATE: 'Configuration modifiée', APPROVAL_REQUEST: 'Approbation demandée', APPROVAL_APPROVED: 'Approbation accordée',
  APPROVAL_REJECTED: 'Approbation refusée', COURIER_INVITED: 'Livreur invité', COURIER_INVITATION_CANCELLED: 'Invitation livreur annulée',
  COURIER_SUSPENDED: 'Livreur suspendu', COURIER_REACTIVATED: 'Livreur réactivé', COURIER_DELETED: 'Livreur supprimé',
  ANNOUNCEMENT_CREATE: 'Annonce créée', ANNOUNCEMENT_UPDATE: 'Annonce modifiée', STOCK_ADJUSTMENT: 'Ajustement de stock',
  USER_DELETED: 'Utilisateur supprimé', USER_SUSPENDED: 'Utilisateur suspendu', USER_REACTIVATED: 'Utilisateur réactivé',
  USER_FORCE_LOGOUT: 'Utilisateur déconnecté de force', CREATE_CASE: 'Dossier créé', ASSIGN_CASE: 'Dossier assigné', RESOLVE_CASE: 'Dossier résolu',
  ADD_CASE_MESSAGE: 'Message ajouté au dossier', SECURITY_EVENT_ACKNOWLEDGE: 'Alerte sécurité prise en compte',
  ADMIN_PROFILE_UPDATED: 'Profil admin modifié', ADMIN_DELETED: 'Admin supprimé', ADMIN_INVITED: 'Admin invité', ADMIN_SUSPENDED: 'Admin suspendu',
  ADMIN_SESSION_REVOKE: 'Session admin révoquée', ADMIN_FORCE_LOGOUT: 'Admin déconnecté de force', EXPORT_REQUEST: 'Export demandé',
  EXPORT_DOWNLOAD: 'Export téléchargé', SUPER_ADMIN_BOOTSTRAP_CREATED: 'Super admin initial créé',
  SUPER_ADMIN_CREDENTIALS_UPDATED: 'Identifiants super admin modifiés', SUPER_ADMIN_PASSWORD_RESET: 'Mot de passe super admin réinitialisé',
  PRODUCT_ARCHIVE: 'Produit archivé', PRODUCT_UNPUBLISH: 'Produit dépublié', PRODUCT_PUBLISH: 'Produit publié',
  UPDATE_PAYMENT_CONFIGURATION: 'Moyen de paiement modifié', FEATURE_FLAG_UPDATE: 'Fonctionnalité modifiée',
  DELIVERY_FEE_SETTINGS_UPDATE: 'Tarif de livraison modifié', DELIVERY_FEE_ZONE_UPDATE: 'Tarif de ville modifié',
  DELIVERY_FEE_ZONE_DELETE: 'Tarif de ville supprimé', APP_VERSION_UPDATE: 'Version d’application modifiée',
  MANUAL_POINT_ADJUSTMENT: 'Ajustement manuel de points', DATABASE_BACKUP_CREATED: 'Sauvegarde créée', RESOLVE_RISK_EVENT: 'Risque résolu',
  COMMISSION_RATE_UPDATE: 'Taux de commission modifié', COMMISSION_SETTLED: 'Commission réglée',
}

/** Humanise an unknown code: "SOME_NEW_CODE" → "Some new code". */
function humanise(code: string): string {
  const words = code.toLowerCase().replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const EN_LABELS: Record<string, string> = {
  TBK_STANDARD: 'TBK delivery', TBK_DELIVERY: 'TBK delivery', LIVRAISON_BOUTIQUE: 'Shop delivery', OK: 'OK',
  UP_TO_DATE: 'Up to date', MPESA: 'M-Pesa', ORANGE_MONEY: 'Orange Money', AIRTEL_MONEY: 'Airtel Money',
}

/** The console language, as the i18n provider sets it on <html lang>. */
const isEnglish = () => typeof document !== 'undefined' && document.documentElement.lang.startsWith('en')

/** Label for an API code in the console language; `fallback` when there is no value. */
export function adminLabel(code?: string | null, fallback = '—'): string {
  if (!code) return fallback
  const raw = code.trim()
  const key = raw.toUpperCase()
  const isCode = /^[A-Z0-9_]+$/.test(raw)
  if (isEnglish()) return EN_LABELS[key] ?? (isCode ? humanise(raw) : raw)
  return LABELS[key] ?? (isCode ? humanise(raw) : raw)
}
