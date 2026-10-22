# Audit E2E TBK — en cours

Acteurs (scripts/e2e_visual_actors.mjs, stamp mvk43y6k, mdp `Visu!Pass-mvk43y6k-7`)
- acheteur visu.acheteur.mvk43y6k@tbk.test
- vendeur  visu.vendeur.mvk43y6k@tbk.test
- livreur  visu.livreur.mvk43y6k@tbk.test
- admins   commerce.test@ / finance.test@tbkmarket.com

Web: Expo web :19006 (code courant). Mobile: Pixel_7 + Expo Go.
Commande de test creee: 38b711e2-e75a-4adb-bdec-9461be031e18

| # | Role | Ecran / fonction | Plateforme | Etat | Detail |
|---|------|------------------|-----------|------|--------|
| 1 | vendeur | connexion | web | OK | session ouverte |
| 2 | vendeur | /seller/products/create | web | PARTIEL | page OK; upload photo non automatisable |
| 3 | acheteur | connexion | web | OK | |
| 4 | acheteur | fiche produit + variante | web | OK | prix variante recalcule correctement (40 -15% = 34) |
| 5 | acheteur | panier | web | OK | 34.00 |
| 6 | acheteur | checkout/delivery | web | OK | commande creee, carte MapLibre rendue |
| 7 | admin | /admin/login (commerce.test@) | web | OK | bouton "Authenticate Session" |
| 8 | admin | /admin/commerce + 5 panneaux | web | OK | 548/580 produits; 212 commandes bloquees (a investiguer) |
| 9 | admin | /admin/finance (role commerce) | web | OK | "Access Prohibited" = RBAC correct |
| 10 | admin | /admin/technical (role commerce) | web | OK | "Access Prohibited" = RBAC correct |
| 11 | admin | **/admin/technical/config (role commerce)** | web | **DEFAUT UI** | S'ouvre alors que le parent est bloque. 7 bascules visibles dont FINANCE/TECHNICAL. Serveur protege (HasPermission par categorie + CanWriteHighRisk, teste). => controles morts qui echoueront au clic, pas une faille. |
| 12 | admin | /admin/advanced | web | OK | |

## A investiguer
- 212 "Stuck Orders" en base de dev: accumulation de tests ou vrai probleme de transition d'etat ?
- /seller/products/new (route inexistante) tombe sur [id] et affiche "Invalid product_id" au lieu d'un 404 propre.

## Android (emulateur Pixel_7 + telephone reel Xiaomi 22111317PI / Android 14, via Expo Go)

| # | Ecran | Etat | Detail |
|---|-------|------|--------|
| 13 | demarrage app | OK | accueil marketplace rendu, produits listes |
| 14 | /categories | OK | FEATURED, Fashion, Shoes, Children, Electronics |
| 15 | /notifications | OK | onglets New / History |
| 16 | /cart | OK | etat vide correct + CTA "Browse Marketplace" |
| 17 | /favorites | OK | etat vide correct |
| 18 | /profile | OK | "Sign in / Create an account" (non connecte) |
| 19 | /seller | OK | "No Business Selected / Sign in as seller" |
| 20 | /orders | **DEFAUT UX** | non connecte: affiche "Could not load - Authorization header is required", erreur technique brute au lieu d'une invite a se connecter |
| 21 | /courier | **CORRIGE** | levait "Native module NativeRNFBTurboApp is not registered". firebaseAuth() court-circuite desormais le require sous Expo Go (Constants.appOwnership). Les 10 routes principales sont propres. |

## Constat majeur sur le test natif
Expo Go ne contient NI le module Firebase NI MapLibre natif. Donc sur Expo Go :
- les ecrans touchant l'auth SMS remontent une erreur LogBox,
- les cartes natives ne peuvent pas s'afficher du tout.
=> Tester le natif pour de vrai exige un **development build EAS**, pas Expo Go.
Ce n'est pas un defaut de l'app: en build EAS les deux modules sont presents.

## Incident cause par l'audit lui-meme
La page de test app/_maptest.tsx importait RoutePlanMap de maniere EAGER, ce qui tire
MapLibre natif au demarrage et faisait planter toute l'app sur Expo Go
("MLRNCameraModule could not be found"). Supprimee. L'app reelle ne souffre pas de ca
car CourierRoutePlanner importe la carte paresseusement.

## Reste a faire (non couvert)
- Parcours vendeur complet (creation produit bloquee par upload photo)
- Parcours livreur complet (accepter/assigner/livrer/QR)
- Paiement + notation
- Dashboards finance / technical / direction avec LEURS propres comptes
- Audit "code mort": aucune suppression faite, car supprimer sur la base d'un
  parcours non exhaustif casserait des chemins non testes.
