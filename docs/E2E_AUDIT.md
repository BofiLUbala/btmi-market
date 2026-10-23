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
- (resolu 23/10, voir session 2) 212 "Stuck Orders" ; /seller/products/new.

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

## Session 2 (23/10/2026) — parcours complet sur la commande BTMI-BR5ZSFFS

Web: Expo :19007 (localhost = un role, 127.0.0.1 = un second role en parallele, localStorage separes).
Mobile: emulateur Pixel (Expo Go, Metro :8081).

| # | Role | Ecran / fonction | Plateforme | Etat | Detail |
|---|------|------------------|-----------|------|--------|
| 22 | acheteur | checkout/delivery : adresse depuis le pin | web | **CORRIGE** | backend reverse-geocode reserve livreur/admin -> nouvelle route /locations/reverse-geocode (connecte, limite). Bouton "Completer l'adresse avec ce lieu" : ne remplit que les champs vides, chaine province/ville/commune coherente, pas de numero si offset_m > 25 m. Province/Ville/Commune remplies (Kinshasa/Kinshasa/Bumbu), rue saisie a la main conservee. |
| 23 | acheteur | carte web : glisser le pin | web | **CORRIGE** | apres un glisse avec inertie, MapLibre termine par un moveend sans originalEvent : le pin n'etait jamais pris. Detecte desormais via movestart. |
| 24 | acheteur | frais 3,50 -> 4,00 | web | OK | 3,50 = tarif par defaut sans ville ; Kinshasa = 4,00 ; recalcule a la selection de la ville. |
| 25 | acheteur | paiement a la livraison (especes) | web | OK | 34 + 4 + 1 = 39,00 ; commande confirmee. |
| 26 | vendeur | accepter / preparer / pret | web | OK | "Mark as ready" avant livreur : 409 COURIER_NOT_ASSIGNED affiche en haut de liste (traduit). |
| 27 | admin commerce | assigner un livreur | web | **CORRIGE** | liste de dizaines de "Joel Kasongo" indiscernables : telephone, e-mail et zone affiches. |
| 28 | livreur | accepter mission | web | OK | |
| 29 | livreur | planificateur d'itineraire (coordonnees) | web | **CORRIGE** | point nomme par /courier/reverse-geocode ("Kinshasa Gombe, Kinshasa"). Ligne Lat/Lng/OK debordait de 16 px (input web sans minWidth 0). Itineraire 2,5 km calcule. |
| 30 | livreur | retrait, date, depart, arrivee | web | OK | |
| 31 | livreur | remise : code colis + especes | web | OK | numero BTMI tape en minuscules/espaces accepte ; especes 39,00 enregistrees. |
| 32 | acheteur | confirmer articles + reception | web | OK | commande COMPLETED. |
| 33 | acheteur | notation commande | web | OK | 4 etoiles + commentaire en base (seller_reviews). |
| 34 | systeme | commission vendeur | base | OK | 3 % de 34 = 1,02 ; net 32,98 ; statut DUE. |
| 35 | acheteur | /orders et /my-orders non connecte | web + Android | **CORRIGE** | invite de connexion au lieu de "Authorization header is required". |
| 36 | vendeur | /seller/products/new | web | **CORRIGE** | "Product not found" au lieu de "Invalid product_id" (seul un UUID est interroge). |
| 37 | admin commerce | /admin/technical/config | web | **CORRIGE (UI)** | les bascules etaient DEJA desactivees (can_write serveur) ; ajoute "Lecture seule : gere par le pole X" (GENERAL = Direction). Lecture de tous les flags par tout admin = voulu (HasPermission). |
| 38 | admin commerce | alerte "Stuck Orders" | web | **CORRIGE** | 91/212 etaient des checkouts abandonnes (aucun paiement choisi), que le vendeur ne peut pas accepter. Exclus -> 121, tous des donnees de test (111 acheteurs de test + 10 ventes boutique de test). |
| 39 | admin finance | /admin/finance | web | OK + **CORRIGE** | meme exclusion dans le scanner de risques (232 -> 141 candidats ; alertes deja ouvertes laissees). Cible sans numero affichee "ORDER ffb42aff" au lieu de "ORDER". |
| 40 | admin technical | /admin/technical + config | web | OK | 4 composants HEALTHY ; seuls les 2 flags TECHNICAL modifiables. |
| 41 | admin direction | /admin + recherche utilisateur | web | OK | audit trace connexions et assignation ; commerce/finance refuses (RBAC). |
| 42 | vendeur | creation produit avec photo | web | OK | photo injectee dans l'input fichier d'expo-image-picker ; publie, 1 image, stock 5. Etoiles d'auto-evaluation : groupe radio nomme (etaient 5 boutons sans libelle). |
| 43 | acheteur | fiche produit a variante unique | web + Android | **CORRIGE** | "Choose first: Model" bloquait Order pour un Model a une seule valeur ; devient une caracteristique. Multi-variantes : la couleur reste a choisir. |

### Constats NON corriges — decision necessaire (securite / produit)
1. **Saisie manuelle du QR colis au retrait** : le champ attend le jeton signe complet (`tbk.d.<uuid>.<HMAC>`, ~90 car.), impossible a taper. Le seul code imprime lisible, `PKG-XXXXXXXX`, est refuse. Et le bouton "I picked it up" valide le retrait SANS scan. Le scan n'est donc pas une preuve aujourd'hui. A trancher : accepter PKG-xxxx, ou rendre le scan obligatoire.
2. **Code de remise a l'acheteur = numero de commande BTMI-...**, que le livreur voit deja dans sa propre app. Il ne prouve pas que l'acheteur est present. A trancher : code a usage unique connu du seul acheteur ?
3. ~~Libelle statut vendeur~~ CORRIGE (23/10, session 2b) : le statut de livraison ne s'affiche que pour READY / READY_FOR_PICKUP / OUT_FOR_DELIVERY / HANDED_TO_PARTNER ; avant, ou apres refus/annulation, c'est le statut de la commande (des commandes REJECTED affichaient "Awaiting a courier").
4. ~~UUID bruts~~ CORRIGE : historique admin = nom de l'acteur (utilisateur, employe ou admin) ou "System" ; detail vendeur = nom de la boutique au lieu du Shop ID.
5. **Consignes TomTom en francais (NON corrige, decision)** : langue figee a fr-FR cote serveur. L'adapter demande de memoriser la langue par itineraire (migration) sinon le recalcul automatique repasse en francais en plein trajet ; tous les textes serveur sont deja en francais. A trancher.
6. ~~Recap acheteur sans frais de paiement~~ CORRIGE : ligne "Payment markup" ajoutee ; 34 + 4 + 1 = 39.
7. /admin/technical : bloc "Mapped Control Domains (Phase 4)" = texte de feuille de route sans fonction. Liste, rien supprime.
8. Base de dev : 91 alertes ORDER_STUCK ouvertes sur des checkouts abandonnes (anciennes regles).

### Toujours non couvert
- Cartes natives et OTP SMS : Expo Go n'a ni MapLibre ni Firebase -> build EAS requis.
- Firebase SMS : numero +243989805614 sous TOO_MANY_ATTEMPTS ; ajouter un "numero de test" dans la console Firebase.
