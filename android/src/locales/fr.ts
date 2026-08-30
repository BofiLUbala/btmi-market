/**
 * French dictionary for the Android app — the source of truth.
 *
 * Every key the app uses must exist here; `en.ts` may lag behind and falls
 * back to these strings. Keys are flat and dotted so the lookup stays a single
 * object access and TypeScript can autocomplete them.
 *
 * Placeholders use {name} and are filled by the `vars` argument of `t()`.
 */
export const fr = {
  /* ── Common ─────────────────────────────────────────────── */
  'common.loading': 'Chargement…',
  'common.oneMoment': 'Un instant…',
  'common.retry': 'Réessayer',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.close': 'Fermer',
  'common.signIn': 'Se connecter',
  'common.signOut': 'Se déconnecter',
  'common.quantity': 'Quantité',
  'common.remove': 'Retirer',
  'common.optional': 'Optionnel',
  'common.cannotLoad': 'Impossible de charger',

  /* ── Onglets ────────────────────────────────────────────── */
  'tabs.home': 'Accueil',
  'tabs.categories': 'Catégories',
  'tabs.cart': 'Panier',
  'tabs.favorites': 'Favoris',
  'tabs.profile': 'Profil',
  'tabs.myCart': 'Mon panier',
  'tabs.myFavorites': 'Mes favoris',
  'tabs.myProfile': 'Mon profil',

  /* ── Préférences ────────────────────────────────────────── */
  'prefs.title': 'Préférences',
  'prefs.language': 'Langue',
  'prefs.theme': 'Apparence',
  'prefs.themeLight': 'Clair',
  'prefs.themeDark': 'Sombre',
  'prefs.switchToDark': 'Passer en mode sombre',
  'prefs.switchToLight': 'Passer en mode clair',
  'prefs.switchToEnglish': 'Switch to English',
  'prefs.switchToFrench': 'Passer en français',

  /* ── Profil ─────────────────────────────────────────────── */
  'profile.yourAccount': 'Votre compte TBK',
  'profile.signInPrompt':
    'Connectez-vous pour retrouver vos commandes, vos points et vos informations.',
  'profile.loading': 'Chargement du profil…',
  'profile.contact': 'CONTACT',
  'profile.noPhone': 'Aucun numéro renseigné',
  'profile.noBackupPhone': 'Aucun numéro secondaire',
  'profile.address': 'ADRESSE',
  'profile.noAddress': 'Aucune adresse enregistrée',
  'profile.noLocation': 'Localisation non renseignée',
  'profile.myOrders': 'Mes commandes',
  'profile.myPoints': 'Mes points TBK',
  'profile.myReviews': 'Mes avis',
  'profile.openSellerSpace': 'Ouvrir l’espace vendeur',
  'profile.editProfile': 'Modifier mon profil',
  'profile.photoTitle': 'Photo de profil',
  'profile.takePhoto': 'Prendre une photo',
  'profile.chooseFromGallery': 'Choisir dans la galerie',
  'profile.changePhoto': 'Changer la photo de profil',
  'profile.uploadFailed': 'Échec de l’envoi',
  'profile.uploadFailedBody':
    'La photo de profil n’a pas pu être enregistrée. Réessayez.',
  'profile.cameraNeeded': 'Caméra nécessaire',
  'profile.cameraNeededBody':
    'Autorisez l’accès à la caméra pour changer votre photo de profil.',
  'profile.photosNeeded': 'Photos nécessaires',
  'profile.photosNeededBody':
    'Autorisez l’accès aux photos pour changer votre photo de profil.',

  /* ── Édition du profil ──────────────────────────────────── */
  'editProfile.title': 'Modifier mon profil',
  'editProfile.firstName': 'Prénom',
  'editProfile.lastName': 'Nom',
  'editProfile.phone': 'Téléphone',
  'editProfile.backupPhone': 'Téléphone secondaire',
  'editProfile.address': 'Adresse',
  'editProfile.addressPlaceholder': 'Avenue, numéro…',
  'editProfile.city': 'Ville',
  'editProfile.commune': 'Commune',
  'editProfile.save': 'Enregistrer',
  'editProfile.saveFailed': 'Le profil n’a pas pu être enregistré.',

  /* ── Panier ─────────────────────────────────────────────── */
  'cart.title': 'Panier · {count}',
  'cart.empty': 'Votre panier est vide',
  'cart.emptyHint': 'Ajoutez un produit pour commencer vos achats.',
  'cart.discover': 'Découvrir les produits',
  'cart.orderFrom': 'Commande chez {shop}',
  'cart.perUnit': '{amount} l’unité',
  'cart.usePoints': 'Utiliser mes points TBK',
  'cart.pointsEnabled': 'Activé',
  'cart.pointsEnable': 'Activer',
  'cart.pointsApplied': '{points} points appliqués · −{amount}',
  'cart.reduceCash': 'Réduisez le montant à payer en cash.',
  'cart.verifiedTotal': 'Total vérifié',
  'cart.estimatedSubtotal': 'Sous-total estimé',
  'cart.priceConfirmed': 'Prix et disponibilité confirmés par la boutique.',
  'cart.priceNextStep':
    'Le prix final et la livraison sont confirmés à l’étape suivante.',
  'cart.placeOrder': 'Passer la commande',
  'cart.signInToContinue': 'Se connecter pour continuer',
  'cart.completeProfile': 'Compléter mon profil',
  'cart.addPhoneTitle': 'Ajoutez un numéro de téléphone',
  'cart.addPhoneBody':
    'Les vendeurs et la livraison ont besoin d’un moyen de vous joindre avant de passer une commande.',
  'cart.invalidCart': 'Panier invalide',
  'cart.invalidCartBody': 'Votre panier ne référence aucune boutique.',
  'cart.verifyFailed':
    'Impossible de vérifier le panier. Vérifiez la disponibilité et réessayez.',
  'cart.orderFailed':
    'La commande n’a pas pu être créée. Le stock a peut-être changé — vérifiez le panier.',
  'cart.profileIncomplete':
    'Ajoutez un numéro de téléphone à votre profil avant de commander.',
  'cart.differentShop': 'Boutique différente',
  'cart.differentShopBody':
    'Votre panier contient déjà des produits d’une autre boutique. Terminez ou videz ce panier avant de continuer.',

  /* ── Produit ────────────────────────────────────────────── */
  'product.promotionUpcoming': 'Bientôt en promo',
  'product.promotionFrom': 'Du {start}',
  'product.promotionTo': 'au {end}',
  'product.regularPrice': 'Prix normal',
  'product.save': 'Vous économisez {amount}',
  'product.loading': 'Chargement du produit…',
  'product.unavailable': 'Ce produit n’est pas disponible pour le moment.',
  'product.soldBy': 'Vendu par {shop}',
  'product.aSeller': 'un vendeur TBK',
  'product.reviewsCount': '{count} avis',
  'product.noReviews': 'Aucun avis pour le moment',
  'product.loadingReviews': 'Chargement des avis…',
  'product.availableOptions': 'Options disponibles',
  'product.chooseOption': 'Choisissez une option',
  'product.inStockCount': 'En stock — {count} disponibles',
  'product.onlyLeft': 'Plus que {count} en stock',
  'product.outOfStock': 'Rupture de stock',
  'product.specifications': 'Caractéristiques',
  'product.description': 'Description',
  'product.addToCart': 'Ajouter au panier',
  'product.buyNow': 'Acheter maintenant',
  'product.customerReviews': 'Avis clients',
  'product.reviewsUnavailable': 'Avis indisponibles',
  'product.reviewsUnavailableBody':
    'Les avis n’ont pas pu être chargés. Réessayez dans quelques instants.',
  'product.noReviewsYet': 'Pas encore d’avis',
  'product.noReviewsYetBody':
    'Les acheteurs ayant terminé leur commande pourront partager ici leur expérience avec ce produit.',
  'product.verifiedReviews': '{count} avis vérifiés',
  'product.verifiedPurchase': 'Achat vérifié',
  'product.helpfulFor': 'Utile pour {count} personne(s)',
  'product.tbkBuyer': 'Acheteur TBK',

  /* ── Avis ───────────────────────────────────────────────── */
  'review.orderExperience': 'Votre expérience de commande',
  'review.productReview': 'Votre avis produit',
  'review.delivery': 'Livraison',
  'review.shopService': 'Service de la boutique',
  'review.overall': 'Expérience globale',
  'review.productQuality': 'Qualité du produit',
  'review.comment': 'Commentaire',
  'review.commentPlaceholder': 'Partagez une expérience précise et utile…',
  'review.publish': 'Publier mon avis',
  'review.saveChanges': 'Enregistrer les modifications',
  'review.failed':
    'L’avis n’a pas pu être enregistré. Vérifiez que la commande est terminée et payée.',
  'review.starsLabel': '{count} étoiles',
} as const

export type TranslationKey = keyof typeof fr
