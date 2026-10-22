Reprends l'audit end-to-end de TBK (marketplace Expo + backend Go) la ou la
session precedente s'est arretee. Lis d'abord docs/E2E_AUDIT.md : il contient
les 21 ecrans deja couverts, les constats et ce qui reste.

## Regles de travail
- Validation VISUELLE obligatoire, jamais sur la seule lecture du code : web
  dans le navigateur integre, mobile sur l'emulateur Pixel_7 / le Xiaomi
  branche en USB via adb.
- Corrige chaque defaut trouve, puis continue le parcours. Commit + push sur
  main au fur et a mesure (chaque push declenche le deploiement prod).
- Tiens docs/E2E_AUDIT.md a jour : une ligne par ecran teste.
- Ne SUPPRIME aucun code sur la foi d'un parcours partiel. Liste d'abord les
  elements morts et fais valider avant suppression.

## Acteurs
`node scripts/e2e_visual_actors.mjs` cree vendeur+business+boutique, acheteur,
livreur actif, et imprime le mot de passe en JSON. Derniers en date (stamp
mvk43y6k, mdp `Visu!Pass-mvk43y6k-7`) :
- acheteur visu.acheteur.mvk43y6k@tbk.test
- vendeur  visu.vendeur.mvk43y6k@tbk.test
- livreur  visu.livreur.mvk43y6k@tbk.test
Admins de test (mdp `TestAdmin@2025!`, cf scripts/e2e_admin_lib.mjs) :
commerce.test@ / finance.test@ / technical.test@ / direction.test@tbkmarket.com
Commande de test deja creee : 38b711e2-e75a-4adb-bdec-9461be031e18

## Environnement
- Web a jour : `npm run web --prefix android -- --port 19006` (API localhost:8080)
- Le site docker :5200 sert un BUILD : `docker compose up -d --build web` dans backend/
- Mobile : Metro `npx expo start --port 8081` dans android/, puis
  `adb -s <device> reverse tcp:8081 tcp:8081` et
  `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081/--/<route>"`

## Pieges deja rencontres (ne pas reperdre de temps dessus)
- Git Bash : `export MSYS_NO_PATHCONV=1` sinon adb/uiautomator recoivent des
  chemins mangles.
- Expo Go n'a NI Firebase natif NI MapLibre natif. Les cartes natives et l'auth
  SMS ne peuvent pas y etre validees : il faut un development build EAS.
- Les groupes Expo Router entre parentheses ne figurent PAS dans l'URL :
  c'est /profile, pas /(buyer)/profile.
- Le bouton de connexion admin s'appelle "Authenticate Session".
- La route de creation produit est /seller/products/create (pas /new).
- Acheteur/vendeur/livreur partagent les cles btmi.access/btmi.refresh ;
  les admins utilisent btmi.admin.*. Changer de role = vider ces cles.
- Plusieurs boutons utilisent window.confirm(), auto-rejete par le navigateur
  integre : stubber `window.confirm = () => true` avant le clic.

## Ce qui RESTE (par ordre de valeur)
1. Cabler le remplissage automatique d'adresse. Le backend est LIVRE et non
   utilise : GET /commerce/reverse-geocode et /courier/reverse-geocode
   (?lng=&lat=) renvoient {place:{building_number,street,commune,city,province,
   province_id,city_id,commune_id,offset_m}}. Cote client, appeler depuis
   DeliveryPointPicker quand le pin se pose, et remplir StructuredAddressFields.
   Decision prise par defaut : ne remplir que les champs VIDES, ne jamais
   ecraser une saisie, et afficher l'adresse trouvee avec un bouton pour
   l'appliquer. offset_m dit a quelle distance l'adresse a ete appariee.
   A faire aussi cote livreur (CourierRoutePlanner).
2. Parcours vendeur complet : creation produit (bloquee par l'upload photo,
   trouver un moyen), stock, commandes, acceptation.
3. Parcours livreur complet : accepter, assigner, itineraire, livrer, QR, payer.
4. Notation acheteur + commission vendeur.
5. Dashboards finance / technical / direction avec LEURS PROPRES comptes
   (seul commerce a ete teste).
6. Defauts connus a corriger :
   - /orders non connecte affiche "Could not load - Authorization header is
     required" au lieu d'une invite a se connecter (les autres ecrans gerent
     proprement ce cas).
   - Un admin commerce atteint /admin/technical/config alors que
     /admin/technical lui est refuse : 7 bascules dont FINANCE/TECHNICAL y sont
     dessinees. Le SERVEUR est sain (HasPermission par categorie +
     CanWriteHighRisk, testes) : c'est de l'UI morte a masquer selon le role.
   - 212 "Stuck Orders" en base de dev : determiner si c'est de l'accumulation
     de tests ou un vrai probleme de transition d'etat.
   - /seller/products/new (inexistante) tombe sur [id] et affiche
     "Invalid product_id" au lieu d'un 404 propre.

## En attente cote utilisateur
- Firebase SMS : la region RDC a ete autorisee dans la console (Allow +
  Congo-Kinshasa). Le numero +243989805614 est sous limitation anti-abus
  TOO_MANY_ATTEMPTS_TRY_LATER le temps que le compteur retombe. Retester
  l'OTP de bout en bout (web ET natif) quand c'est leve. Alternative sans
  attendre : Firebase Console > Authentication > Sign-in method > Phone >
  "Phone numbers for testing", y ajouter le numero avec un code fixe.
