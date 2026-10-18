# TBK — fiche App Store (brouillon à valider)

Champs à remplacer avant envoi : `<SUPPORT_EMAIL>`, `<SITE_URL>`, `<PRIVACY_URL>`, `<ADRESSE_POSTALE>`.

## Informations générales
- Nom (30 car. max) : `TBK Market`
- Sous-titre (30 car. max) : FR `Achetez et faites-vous livrer` / EN `Shop and get delivered`
- Bundle ID : `com.tbk.market`
- Catégorie principale : Shopping — secondaire : Lifestyle
- Classification d'âge : 12+ (messagerie entre utilisateurs, contenu généré par les utilisateurs)
- Prix : Gratuit
- Langues : Français (principale), Anglais
- Copyright : `© 2026 TBK`
- URL d'assistance : `<SITE_URL>/support`
- URL de confidentialité : `<PRIVACY_URL>` (obligatoire)

## Français
**Texte promotionnel (170 car.)**
Découvrez les boutiques près de chez vous, commandez en quelques touches et suivez votre livreur en direct sur la carte.

**Description**
TBK est la place de marché qui connecte acheteurs, vendeurs et livreurs.

Pour les acheteurs
• Parcourez les catégories et les offres des boutiques
• Recherchez un produit à partir d'une photo
• Discutez avec le vendeur à propos de votre commande
• Suivez la livraison en direct sur la carte
• Confirmez la remise du colis en scannant un QR code

Pour les vendeurs
• Gérez vos boutiques, produits et commandes
• Mettez vos articles en avant avec des offres et des vidéos courtes
• Échangez avec vos clients

Pour les livreurs
• Recevez vos missions et partagez votre trajet avec l'acheteur pendant la livraison
• Le partage de position s'arrête à l'arrivée

Notifications pour suivre chaque étape de votre commande.

**Mots-clés (100 car.)** `marché,boutique,livraison,achat,vendeur,livreur,commande,Congo,Kinshasa,shopping`

## English
**Promotional text**
Discover shops near you, order in a few taps and follow your courier live on the map.

**Description**
TBK is the marketplace that connects buyers, sellers and couriers.

For buyers
• Browse categories and shop offers
• Search for a product from a photo
• Chat with the seller about your order
• Track your delivery live on the map
• Confirm hand-over by scanning a QR code

For sellers
• Manage your shops, products and orders
• Promote items with offers and short videos
• Talk to your customers

For couriers
• Receive missions and share your route with the buyer during delivery
• Location sharing stops on arrival

Notifications keep you updated at every step of your order.

**Keywords** `marketplace,shop,delivery,buy,seller,courier,order,Congo,Kinshasa,shopping`

## Notes pour la revue Apple
- Compte de démonstration : `<DEMO_BUYER_EMAIL>` / `<DEMO_PASSWORD>` (à créer ; ne pas mettre de vrai mot de passe dans ce fichier)
- Position en arrière-plan : utilisée uniquement quand un livreur a une livraison en cours, pour que l'acheteur voie le trajet. Le partage s'arrête à l'arrivée.
- Caméra : scan du QR de remise du colis ; photo pour la recherche par image.
- Pour tester la livraison en direct, utiliser le compte livreur de démonstration `<DEMO_COURIER_EMAIL>`.

## Questionnaire « App Privacy » (App Store Connect)
Données collectées, liées à l'identité de l'utilisateur, sans suivi publicitaire :
| Type | Usage | Détail |
|---|---|---|
| Nom, e-mail, téléphone | Fonctionnalités de l'app, compte | Inscription et contact de livraison |
| Adresse physique | Fonctionnalités de l'app | Adresse de livraison |
| Position précise | Fonctionnalités de l'app | Livreur pendant une mission ; acheteur à sa demande |
| Photos | Fonctionnalités de l'app | Recherche d'un produit par image |
| Historique d'achats | Fonctionnalités de l'app | Commandes |
| Contenu utilisateur (messages) | Fonctionnalités de l'app | Chat acheteur / vendeur / livreur |
| Identifiant d'appareil (jeton push) | Fonctionnalités de l'app | Notifications |

Suivi (tracking) : **Non**.

## Captures d'écran
Apple exige au minimum le jeu iPhone 6,9" : 1320×2868 ou 1290×2796 px (3 à 10 images). Les fichiers actuels de `store-assets` font 1080×1920 : ils seront refusés tels quels. Il faut les recapturer depuis le simulateur ou un iPhone.

## Points bloquants à corriger avant la soumission (règles Apple)
1. **Suppression de compte dans l'app** (règle 5.1.1(v)) : l'app permet de créer un compte, mais je n'ai trouvé aucune fonction de suppression par l'utilisateur dans `android/src` ni `backend`. Apple rejette sans cela.
2. **Politique de confidentialité** : aucune page trouvée dans l'app ni le site web. L'URL est obligatoire dans App Store Connect et un lien doit aussi être visible dans l'app.
3. **Conditions d'utilisation / modération** : l'app a un chat entre utilisateurs. Apple attend des moyens de signaler et de bloquer un utilisateur (règle 1.2).
4. **Paiement** : si l'app vend des biens physiques, le paiement hors Apple est autorisé. Si elle vend du contenu numérique, il faudrait l'achat intégré.
