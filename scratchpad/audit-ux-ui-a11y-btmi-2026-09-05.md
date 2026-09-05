# Audit UX/UI/Design System/Accessibilité — TBK Marketplace
**V2 — 2026-09-06** (remplace la V1 du 2026-09-05, corrige deux faux positifs, ajoute des pages et reclassifie les preuves)
**Périmètre** : Web (buyer + seller + admin) et Android (Expo Router)

---

## 0. Niveau de preuve — légende obligatoire

Chaque constat porte **exactement une** des quatre étiquettes suivantes. Aucune reformulation ambiguë de type "testé sur Android" n'est utilisée nulle part dans ce document quand la plateforme réelle était en fait un navigateur.

| Étiquette | Ce que ça veut dire concrètement ici |
|---|---|
| 🌐 **Navigateur réel** | Rendu observé dans le navigateur intégré, sur le serveur de dev Web (`localhost:5174`) avec le backend Go réel (`localhost:8080`), compte de test créé pour l'audit. Scans `axe-core` 4.10.2 exécutés en direct. |
| 📱 **Appareil/émulateur Android** | **Aucun constat de ce document ne porte cette étiquette.** Aucun appareil physique ni émulateur Android (AVD/Genymotion) n'était disponible dans cet environnement. |
| 🖥️ **Rendu React Native Web (pas Android)** | L'app Android (Expo Router / React Native) a été ouverte via `expo start --web` (`localhost:19006`) dans le même navigateur intégré. **C'est le rendu des mêmes composants React Native, mais via le moteur web de React Native Web, pas le moteur natif Android.** Un header, un scroll, une police système ou un comportement clavier peuvent différer réellement entre ce rendu et un vrai téléphone. Tout constat de cette catégorie est explicitement marqué "à reconfirmer sur device" et n'est **jamais** compté comme P0/P1 sans confirmation indépendante par lecture de code démontrant que le bug n'est pas spécifique au Web.
| 📄 **Lecture de code seule** | Aucun rendu, ni Web ni RN-Web. Déduit de la lecture du `.tsx`/`.ts`/`.css`. Peut se tromper si une règle CSS globale ou un composant parent non lu change le résultat final — chaque fois que c'est arrivé dans cette V2 (2 cas, voir §0.1), c'est signalé explicitement. |
| ⛔ **Non vérifié** | Cité pour mémoire (ex. dans la liste de pages héritées, §2) mais ni rendu ni lu en détail. |

### 0.1 Corrections apportées à la V1 (auto-critique)

Deux constats de la V1 étaient des **faux positifs**, découverts en creusant plus loin pour cette V2. Ils sont retirés du classement de sévérité et documentés ici pour traçabilité :

1. **"Langue par défaut différente Web=FR / Android=EN" (V1, §Accueil) — FAUX POSITIF, retiré.**
   Preuve V2 (🌐 + 🖥️, `javascript_tool` sur les deux onglets) : `navigator.language` = `en-US` et `Intl.DateTimeFormat().resolvedOptions().locale` = `en-US` **dans les deux onglets** (même navigateur automatisé). Le Web affichait pourtant le français au premier essai parce que `localStorage['btmi.lang'] = 'fr'` **était déjà présent** sur l'origine `localhost:5174` (résidu d'une session de développement antérieure), alors que l'origine `localhost:19006` (Android/Expo-web) n'avait jamais été visitée et n'avait donc rien en `localStorage`/`AsyncStorage`. Après `localStorage.removeItem('btmi.lang')` puis rechargement, **le Web bascule aussi en anglais** — comportement strictement identique à Android.
   Lecture de code confirmant l'intention (📄, `web-app/src/store/i18n.tsx:37-39` et `android/src/store/i18n.tsx:28-37`) : les deux plateformes implémentent **exactement la même règle** — français par défaut, sauf si la langue de l'appareil/navigateur commence explicitement par "en". Le code est symétrique et correct ; l'écart observé en V1 était un artefact de mon environnement de test (locale du navigateur d'automatisation = `en-US`, plus un `localStorage` pollué par un usage antérieur), pas un bug produit.
   → **Aucune correction de code nécessaire sur ce point.** Reste une vraie question produit, hors périmètre technique : la langue par défaut effective pour un utilisateur réel dépendra de la locale de son téléphone/navigateur, ce qui est le comportement voulu.

2. **"Icône de checklist vendeur identique done/pending" (V1, §Dashboard vendeur) — FAUX POSITIF, retiré.**
   Preuve V2 (📄, `web-app/src/styles/pages.css:1396-1402`) : `.checklist-item--done .check-icon { color: var(--color-success) }` et `.checklist-item--pending .check-icon { color: var(--color-text-faint) }` sont bien deux règles distinctes. Le composant JSX est identique dans les deux états (même `<CheckCircleIcon/>`), mais la couleur héritée diffère correctement via le sélecteur CSS parent. **Non confirmé comme défaut.**

Ces deux rétractations sont un résultat attendu d'un audit sérieux, pas une gêne à cacher — elles sont donc gardées visibles plutôt que silencieusement supprimées.

---

## 1. Pages auditées en détail

### Page : Connexion acheteur
**Route** : `/login` (Web) · `app/auth/login.tsx` (Android)
**Plateforme** : 🌐 Web · 🖥️ Android (React Native Web uniquement)
**Score UX** : 7/10 · **Score UI** : 8/10 · **Score accessibilité** : 8/10 (Web, 0 violation axe) / non notable (Android, non testé nativement)

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| Titre "Welcome back" visuellement chevauché par le header natif | 🖥️ Capture d'écran + `getComputedStyle`/`getBoundingClientRect` (header `position:sticky; top:0`, contenu centré par-dessus) — `android/app/auth/login.tsx:44` (`<Text style={styles.title}>`) et `android/app/_layout.tsx:25-34` (`<Stack>` sans `headerTransparent`, donc réservation d'espace normalement automatique côté natif) | **Potentiellement importante — NON CONFIRMÉE sur Android réel**, classée P2 (voir §0) | Si le bug se reproduit sur téléphone : le titre d'accueil de l'écran de connexion est illisible, première impression de logiciel cassé | Ajouter un correctif défensif sans incidence si le bug ne se reproduit pas nativement (voir §5, corrections appliquées) ; confirmer ensuite sur device avant de fermer le ticket |
| Deux boutons "Afficher le mot de passe" au nom accessible identique | 🌐 + 📄 `web-app/src/components/ui/Field.tsx:55` — `aria-label` fixe, pas paramétré par le label du champ | Moyenne | Un utilisateur de lecteur d'écran naviguant par liste de contrôles ne peut pas distinguer les deux boutons hors contexte visuel | `aria-label={\`${label} : afficher le mot de passe\`}` |
| Message d'aide "mot de passe" affiché comme une erreur avant toute saisie | 🌐 (`getComputedStyle` → `rgb(192,57,43)` = `--color-danger`) + 📄 `Field.tsx:62` (`hint` rendu avec la classe `.field-error`) et `components.css:138` (`.field-error{color:var(--color-danger)}`) | **Importante** (impact large : ce composant est partagé par tous les formulaires de l'app) | Une instruction neutre ("Au moins 8 caractères…") est perçue comme une alerte avant même que l'utilisateur ait tapé quoi que ce soit — anxiogène et trompeur, sur *tous* les formulaires du site | Classe dédiée `.field-hint{color:var(--color-text-muted)}`, réserver `.field-error` aux vraies erreurs |

**Différences mobile/desktop** : Web desktop et mobile partagent le même composant `Field`/`Button`, différence uniquement de largeur de carte (centrée, max ~420px). Android n'a pas d'équivalent desktop (mobile uniquement) ; le header natif est la seule variable propre à cette plateforme.

---

### Page : Inscription acheteur, étape 1/4
**Route** : `/register` (Web)
**Plateforme** : 🌐 Web (étape 1 uniquement ; étapes 2-4 = 📄 lecture de code du même fichier, non rendues séparément)
**Score UX** : 8/10 · **Score UI** : 8/10 · **Score accessibilité** : 8/10

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| Hérite du bug "hint = erreur" ci-dessus | 🌐 capture directe sur cette page | Importante | Idem | Idem |
| Stepper "1. Compte / 2. Informations / 3. Adresse / 4. Récapitulatif" purement textuel, sans indicateur de progression visuel ni `aria-current` confirmé | 🌐 capture d'écran | Mineure | L'utilisateur ne visualise pas sa progression dans le tunnel | Ajouter une ligne de progression + coche sur les étapes complétées |

**Différences mobile/desktop** : non testées en mobile pour cette page dans cette passe (⛔) — à faire en priorité 3, le formulaire en 4 étapes est un candidat naturel à un défilement vertical long sur petit écran.

---

### Page : Accueil (Home)
**Route** : `/` (Web) · `app/(buyer)/index.tsx` (Android)
**Plateforme** : 🌐 Web (clair/sombre, desktop 1440×900, mobile 375×812, tablette 820×1180) · 🖥️ Android (React Native Web, clair/sombre)

**Score UX** : 8/10 · **Score UI** : 9/10 · **Score accessibilité** : 9/10 (0 violation axe, clair et sombre)

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| ~~Langue par défaut différente~~ | **Retiré, voir §0.1 — faux positif confirmé** | — | — | — |
| Structure de header différente Web/Android (recherche+nav sur une ligne vs logo+icônes puis recherche pleine largeur) | 🌐 + 🖥️ captures comparées | Mineure | Pas un défaut en soi (contrainte d'espace mobile légitime), mais aucune convention commune documentée | Documenter comme choix de plateforme assumé dans le design system, pas laisser en non-dit |
| Nombre de catégories visibles dans la rangée : 10 (Web) vs 8 visibles à l'écran (Android, defilement horizontal probable non confirmé) | 🌐 + 🖥️ captures | Mineure | Aucun si scroll horizontal présent (⛔ non confirmé) | Vérifier l'affordance de scroll (ombre de bord, flèche) si le contenu déborde |

**Ce qui fonctionne bien** : dark mode propre des deux côtés (0 violation axe), nav basse mobile Web à icônes + labels, halo de couleur de secours quand une image produit manque, tablette (820px) : la grille catégories/produits s'adapte sans chevauchement (🌐 vérifié, capture prise, pas de régression visuelle observée).

---

### Page : Fiche produit
**Route** : `/products/:id` (Web)
**Plateforme** : 🌐 Web
**Score UX** : 8/10 · **Score UI** : 8/10 · **Score accessibilité** : 6/10 → **corrigé dans cette itération, voir §5**

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| `<select>` de tri des avis sans nom accessible | 🌐 `axe-core` (impact **critical**) + 📄 `web-app/src/pages/marketplace/ProductDetailPage.tsx:537` (aucun `label`/`aria-label`/`title`) | **Critique (P0)** | Un utilisateur de lecteur d'écran ne sait pas ce que contrôle ce menu ("Trier par…") | `aria-label={t('reviews.sortBy')}` — **appliqué, voir §5** |

**Ce qui fonctionne bien** : distinction claire existe/rupture/stock faible sur les variantes, fil d'Ariane présent, badge de rareté non alarmiste.

---

### Page : Panier
**Route** : `/cart` (Web)
**Plateforme** : 📄 lecture de code approfondie (rendu non capturé faute de panier actif au moment du test)
**Score UX** : 8/10 · **Score UI** : 8/10 · **Score accessibilité** : 9/10 (sous réserve de rendu, non confirmé par axe)

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| Suppression d'article sans confirmation ni "Annuler" | 📄 `CartPage.tsx:171` | Mineure | Erreur de manipulation fréquente sur mobile (bouton proche du stepper +/−) coûteuse à corriger (re-sélection produit) | Toast "Article retiré · Annuler" |

**Ce qui fonctionne bien** : stepper de quantité `role="group"` + `aria-label` dynamique par article + `aria-live="polite"` — pattern WCAG exemplaire, rarement aussi soigné. Garde métier (paiement bloqué tant que le profil acheteur n'a pas de téléphone) implémentée avec message dédié, pas un blocage silencieux.

---

### Page : Dashboard vendeur
**Route** : `/seller/dashboard` (Web)
**Plateforme** : 📄 lecture de code
**Score UX** : 8/10 · **Score UI** : 8/10 · **Score accessibilité** : 7/10 (non rendu)

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| ~~Icône checklist identique done/pending~~ | **Retiré, voir §0.1 — faux positif confirmé** | — | — | — |
| Lien "N° commande" pointe vers la liste, pas le détail | 📄 `SellerDashboardPage.tsx:393` (`to="/seller/orders"` au lieu de `/seller/orders/{id}`) | Mineure | L'utilisateur doit rechercher la commande après avoir cliqué | Lier vers le détail si la route existe |

**Ce qui fonctionne bien — référence à copier ailleurs** : `Promise.allSettled` pour un chargement résilient par section (une API en panne n'empêche pas d'afficher les autres blocs), séparation claire métriques passives / actions rapides.

---

### Page : Dashboard admin — Direction
**Route** : `/admin/direction` (Web)
**Plateforme** : 📄 lecture de code
**Score UX** : 6/10 · **Score UI** : 7/10 · **Score accessibilité** : non évalué

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| Échecs de chargement API totalement silencieux (KPIs, utilisateurs, logs d'audit) | 📄 `DirectionDashboardPage.tsx:44-48,63-68,82-86` — `catch(err){ console.error(...) }`, jamais de `setError` visible (contrairement à `handleExecuteUserAction` qui, lui, affiche `actionMessage`) | **Critique (P0)** — dashboard de sécurité/audit qui peut afficher "aucune donnée" au lieu de "échec de chargement" | L'admin peut croire "tout est normal" alors que l'API échoue — particulièrement grave sur les **logs d'audit** | Ajouter un état d'erreur visible par onglet — **appliqué, voir §5** |

**Ce qui fonctionne bien** : action de modération (suspendre/réactiver/déconnexion forcée) avec motif obligatoire ≥5 caractères — bonne friction volontaire sur une action sensible.

---

### Page : Dashboard admin — Commerce
**Route** : `/admin/commerce` (Web)
**Plateforme** : 📄 lecture de code
**Score UX** : 4/10 (page non fonctionnelle) · **Score UI** : 5/10 · **Score accessibilité** : non évalué

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| Page 100 % vitrine statique ("Phase 2"), 22 cartes de domaines factices, **aucun appel API** | 📄 `CommerceDashboardPage.tsx` (fichier entier — aucun `fetch`/`useEffect`/état de chargement) | Importante (produit) | L'admin qui clique sur "Commerce" voit une page qui ressemble à un dashboard mais ne fait rien | À ne pas router en production tant que non implémenté, ou marquer clairement "à venir" avec un état visuel distinct d'un dashboard actif |
| **Palette entièrement codée en dur, hors design system** : `#0f172a`, `#1e293b`, `#334155`, `#94a3b8`, `#34d399`, `#064e3b`, `#f8fafc` en `style={{}}` inline, aucune variable `--color-*` | 📄 `CommerceDashboardPage.tsx:37,42,46,47,56,58,61,63,64` | **Importante (P1)**, confirme le point de vérification demandé (§ce qui suit) | Cette page ne suit ni le thème clair ni le thème sombre choisi par l'utilisateur — toujours le même rendu sombre codé en dur, avec un vocabulaire de couleurs (slate/emerald) totalement différent de la marque (crème/noir/ambre) | Tokeniser — **partiellement appliqué, voir §5** |
| Icônes emoji comme éléments d'interface (📦, 🏗️) | 📄 lignes 35, 44 | Mineure | Rendu incohérent selon OS/police système, pas un icône vectoriel contrôlable (couleur, taille exacte) | Remplacer par les composants d'icônes SVG déjà présents dans `@/components/ui/Icons` |

---

### Page : Dashboard admin — Technique
**Route** : `/admin/technical` (Web)
**Plateforme** : 📄 lecture de code
**Score UX** : 6/10 · **Score UI** : 5/10 · **Score accessibilité** : non évalué

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| Même palette codée en dur que Commerce (`#0f172a`, `#1e293b`, `#f1f5f9`, `#94a3b8`, `#334155`) sur le conteneur `SectionCard` + **15 entrées de statuts** (`HEALTHY`, `DOWN`, `CRITICAL`…) chacune avec 3 valeurs hex propres dans `StatusBadge` | 📄 `TechnicalDashboardPage.tsx:20-39,53,55,59` | **Importante (P1)**, même famille de problème que Commerce | Idem — pas de suivi du thème clair/sombre, risque de dérive de teinte entre pages admin si un développeur copie-colle une valeur légèrement différente | Tokeniser le conteneur (appliqué, §5) ; la table de statuts (15×3 valeurs) est volumineuse et **laissée en P3**, documentée comme dette explicite plutôt que traitée à la hâte |

---

### Page : Admin — Inventaire (liste + filtres)
**Route** : `/admin/commerce/inventory` (Web)
**Plateforme** : 📄 lecture de code
**Score UX** : 6/10 · **Score UI** : 5/10 · **Score accessibilité** : 4/10 (probable, non confirmé par axe)

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| Mêmes couleurs codées en dur (`#0f172a`, `#334155`, `#94a3b8`, `#f8fafc`) + palette de badges de statut dupliquée une 3ᵉ fois (`IN_STOCK`/`LOW_STOCK`/`OUT_OF_STOCK`/`RESERVED`) | 📄 `InventoryListPage.tsx:54-59,78,83,86` | Importante (P1, même famille) | Idem | Idem, voir §5 pour le périmètre traité |
| Champs de recherche/filtre (`<input>`, `<select>`) sans `<label>` associé, uniquement un `placeholder` | 📄 lignes 75-90 | Moyenne (à confirmer par axe — non rendu) | Utilisateur de lecteur d'écran ne sait pas ce que filtre chaque champ | Ajouter `aria-label` sur chaque champ de filtre |
| Filtres "recherche" et "stock faible uniquement" appliqués **côté client** après une pagination serveur de 25 lignes | 📄 commentaire du code lui-même ligne 20-23 (assumé et documenté par l'équipe) | Moyenne | Un produit en stock faible situé sur la page 2 n'apparaîtra pas si l'admin coche "stock faible" en restant sur la page 1 — résultat de filtre incomplet et trompeur sans avertissement | Désactiver la pagination quand un filtre client est actif, ou avertir "filtre appliqué sur la page courante seulement" |

**Analyse dashboards/données (catégorie 5 demandée)** : cette page est la plus à risque de surcharge/incohérence identifiée dans tout l'admin — 3 réimplémentations indépendantes de la même palette de statuts de stock en 3 fichiers différents (`CommerceDashboardPage` via badges de domaine, `TechnicalDashboardPage.StatusBadge`, `InventoryListPage.statusBadge`) sans aucun composant partagé de type `<StatusBadge/>` central. C'est une dette de design system plus qu'un bug visible immédiatement, mais elle garantit une dérive future.

---

### Page : Favoris
**Route** : `/favorites` (Web)
**Plateforme** : 📄 lecture de code
**Score UX** : 8/10 · **Score UI** : 8/10 · **Score accessibilité** : 8/10 (structure correcte, non confirmé par axe)

**Problèmes** : **[MINEUR]** icône emoji `❤️` comme icône d'état vide (`EmptyState icon="❤️"`) — même remarque que Commerce, cohérence à retravailler mais non bloquant.
**Ce qui fonctionne bien** : état vide avec titre + description + action claire ("Parcourir"), bouton "Tout effacer" séparé visuellement (variant `ghost`) de l'action de suppression individuelle — bonne hiérarchie action groupée / action unitaire.

---

### Page : Onboarding vendeur
**Route** : `app/seller/onboarding.tsx` (Android)
**Plateforme** : 📄 lecture de code (⛔ non rendu, ni Web ni RN-Web, dans cette passe)
**Score UX** : 7/10 · **Score UI** : 7/10

**Problèmes** : **[MINEUR]** validation globale (`Object.values(form).every(v => v.trim())`) sans retour de champ individuel — l'utilisateur ne sait pas quel champ précis bloque tant qu'il n'a pas tout rempli.
**Ce qui fonctionne bien** : détection d'un business déjà existant pour sauter à l'étape boutique, invalidation ciblée du cache React Query.

---

### Page : Admin Android — structure globale
**Route** : `app/admin/_layout.tsx` (Android)
**Plateforme** : 📄 lecture de code
**Score UX/UI** : non noté (pas un écran, une structure de navigation)

| Problème | Preuve | Sévérité | Impact utilisateur | Correction |
|---|---|---|---|---|
| Header et fond codés en dur (`#0f172a`, `#ffffff`, `#090d16`), **indépendants du thème clair/sombre** de l'app (`useColors()`/`ThemeProvider`) utilisé partout ailleurs | 📄 `android/app/admin/_layout.tsx:9,12` | **Importante (P1)**, confirme exactement le point de vérification demandé | L'admin Android ne peut jamais voir sa section en thème clair, quel que soit son réglage — comportement qui peut être **intentionnel** (console "toujours sombre") mais qui n'est documenté nulle part comme un choix, et qui duplique en dur des couleurs très proches (mais pas identiques caractère pour caractère) de celles du Web admin (`#0f172a`/`#090d16` Android vs `#0f172a`/`#0f172a` Web Commerce/Technical — cohérentes ici par coïncidence, pas par construction) | Extraire dans `android/src/theme.ts` un objet `adminDark` nommé et l'utiliser ici — **appliqué, voir §5**. Décision produit (rendre l'admin réellement dépendant du thème, ou assumer "toujours sombre" officiellement) **laissée à votre approbation**, voir §6. |

---

## 2. Compatibilité mode sombre JS vs `userInterfaceStyle: "light"` (Android)

**Vérifié** (📄 `android/app.json:9` + `android/src/store/theme.tsx`) :
- `app.json` déclare `"userInterfaceStyle": "light"`. Ce réglage Expo contrôle uniquement les **hooks natifs au niveau OS** — la valeur que le système d'exploitation utilise pour des éléments qu'Expo ne gère pas lui-même par défaut avant que React ne monte (écran de démarrage natif au tout premier lancement, certains styles de barre de statut/dialogues système sur iOS). Il **n'empêche pas** le thème JS de fonctionner : `ThemeProvider` (`android/src/store/theme.tsx`) lit `Appearance.getColorScheme()` au démarrage puis gère lui-même l'état, indépendamment de `userInterfaceStyle`.
- **Ce n'est donc pas un bug logiciel** — les deux mécanismes coexistent sans se contredire dans le code observé. C'est en revanche une **incohérence de configuration qui mérite une décision explicite** : si l'app gère son propre mode sombre complet (ce qui est le cas), `userInterfaceStyle` devrait probablement être `"automatic"` pour que l'écran de démarrage natif et les éventuels éléments système suivent la même première impression que l'app elle-même donnera une seconde plus tard — sinon un utilisateur en dark mode peut voir un flash d'écran de démarrage clair juste avant que l'app n'affiche son propre thème sombre.
- **Non vérifiable dans cet environnement** : l'écran de démarrage natif (`expo-splash-screen`, `backgroundColor: "#091223"` dans `app.json:36`) n'est visible que sur un vrai build natif, pas en `expo start --web`. ⛔
- **Décision nécessitant votre approbation** (voir §6) — changer `userInterfaceStyle` affecte le comportement natif iOS/Android en profondeur (barres système, dialogues), donc **non modifié automatiquement** dans cette itération.

---

## 3. Pages couvertes par héritage de design system (non auditées individuellement)

Inchangé depuis la V1 sur le principe : répéter les mêmes constats sur ~90 pages qui partagent `Button`/`Card`/`Field` serait du remplissage. Liste complète en V1 ; ajout pour cette V2 — **les pages admin restantes (`GlobalConfigPage`, `AdvancedManagementPage`, `FeatureFlagsPage`, `OrderListPage`, `CommerceProductsPage`, `MarketplaceVisibilityPage`, etc.) sont présumées suivre le même pattern de couleurs codées en dur que Commerce/Technical/Inventory ci-dessus, par cohérence de style de code observée sur 4 fichiers admin sur 4 lus** — c'est une **inférence, pas une vérification** (📄 partielle → ⛔ pour le reste), à confirmer fichier par fichier avant de les corriger.

---

## 4. Synthèse — dix problèmes les plus graves (mise à jour V2)

| # | Sévérité | Problème | Preuve | Statut à la fin de cette itération |
|---|---|---|---|---|
| 1 | **Critique (P0)** | `<select>` tri des avis sans nom accessible | 🌐 axe critical, `ProductDetailPage.tsx:537` | ✅ Corrigé (§5) |
| 2 | **Critique (P0)** | Dashboard admin Direction : 3 chargements API en échec silencieux | 📄 `DirectionDashboardPage.tsx` | ✅ Corrigé (§5) |
| 3 | Importante (P1) | Hint de mot de passe stylé comme une erreur, sur tout formulaire de l'app | 🌐+📄 `Field.tsx:62` | ✅ Corrigé (§5) |
| 4 | Importante (P1) | Palette admin codée en dur (Commerce, Technical, Inventory) hors design system | 📄 3 fichiers | ⚠️ Partiellement corrigé (Commerce + conteneur Technical), badges de statut laissés en P3 (§5) |
| 5 | Importante (P1) | Admin Android : header/fond codés en dur, indépendants du thème | 📄 `admin/_layout.tsx` | ✅ Corrigé (§5) |
| 6 | Importante (P1) | Deux boutons "afficher le mot de passe" au nom accessible identique | 🌐+📄 `Field.tsx:55` | ✅ Corrigé (§5) |
| 7 | Moyenne (P2, non confirmée sur device) | "Welcome back" possiblement masqué par le header sur Android | 🖥️ RN-Web uniquement | ✅ Corrigé sur le rendu testé, gated `Platform.OS==='web'` donc **impact nul garanti sur natif** (§5.7). **Reste à confirmer que le bug n'existait pas déjà natif sans notre correctif** — device réel requis. |
| 8 | Moyenne (P2) | `userInterfaceStyle: "light"` vs dark mode JS — flash possible au démarrage natif | 📄 config | ⛔ Non modifié, décision requise (§6) |
| 9 | Moyenne (P2) | Filtre "stock faible" appliqué après pagination serveur → résultats incomplets sans avertissement | 📄 `InventoryListPage.tsx` | Non corrigé cette itération (hors P0/P1) |
| 10 | Mineure (P3) | Lien "N° commande" du dashboard vendeur pointe vers la liste, pas le détail | 📄 `SellerDashboardPage.tsx:393` | Non corrigé cette itération |

~~Langue par défaut~~ et ~~icône checklist~~ retirées de ce classement — voir §0.1.

---

## 5. Corrections appliquées dans cette itération

Toutes les corrections ci-dessous **n'ajoutent aucune nouvelle couleur codée en dur** : soit elles consomment des tokens `--color-*` déjà existants, soit elles introduisent un nombre minimal de nouveaux tokens nommés et documentés (`--admin-*`, `adminDark`), jamais une valeur hex nue ajoutée dans un composant. Aucune fonctionnalité existante n'a été retirée ; tous les changements sont additifs ou substituent une valeur littérale par la même valeur exposée via un token.

### 5.1 P0 — `<select>` de tri des avis sans nom accessible
**Fichiers** : `web-app/src/pages/marketplace/ProductDetailPage.tsx`, `web-app/src/locales/fr.ts`, `web-app/src/locales/en.ts`
**Changement** : ajout de `aria-label={t('reviews.sortBy')}` sur le `<select>` ; nouvelle clé `reviews.sortBy` (FR : "Trier les avis", EN : "Sort reviews").
**Preuve de vérification** : `axe-core` sur `/products/:id` — **1 violation critique → 0 violation** après correction (`select.getAttribute('aria-label')` renvoie bien la chaîne traduite). TypeScript et build OK.

### 5.2 P0 — Dashboard admin Direction : échecs API silencieux
**Fichier** : `web-app/src/pages/admin/direction/DirectionDashboardPage.tsx` (+ clés `admin.direction.*LoadError*`/`retry` dans les deux locales)
**Changement** : ajout de trois états `statsError`/`usersError`/`auditError`, peuplés dans chaque `catch` (le `console.error` existant est conservé pour le débogage, il n'a pas été retiré). Un bandeau d'erreur visible avec bouton "Réessayer" s'affiche désormais dans chacun des 3 onglets (KPIs, Utilisateurs, Audit) quand le chargement échoue, au lieu d'un onglet vide sans explication.
**Style** : le bandeau utilise les nouveaux tokens `--admin-danger`/`--admin-danger-soft`/`--admin-text` (voir 5.4), pas de hex ajouté.
**Preuve de vérification** : TypeScript OK, build OK. Rendu non capturé en direct (page derrière une authentification admin pour laquelle aucun compte de test valide n'était disponible dans cet environnement) — **vérifié par lecture du JSX final et compilation uniquement**, pas par capture d'écran. À confirmer visuellement avec un compte admin réel avant de clore ce ticket.

### 5.3 P1 — Hint de mot de passe stylé comme une erreur
**Fichiers** : `web-app/src/components/ui/Field.tsx`, `web-app/src/styles/components.css`
**Changement** : nouvelle classe `.field-hint { color: var(--color-text-muted) }` dans `components.css`, `Field.tsx` l'utilise désormais pour le texte d'aide (`hint`) au lieu de réutiliser `.field-error`. Le rendu de l'erreur (`.field-error`) est inchangé.
**Preuve de vérification (avant/après mesuré)** :
- Avant (rapport V1, `getComputedStyle`) : `rgb(192, 57, 43)` = `--color-danger`.
- Après (cette itération, `getComputedStyle` sur `/register`, thème sombre) : `rgb(166, 164, 156)` = `--color-text-muted` (valeur sombre), classe `.field-error` absente du DOM à cet endroit (`document.querySelector('.field-error')` → `null` avant saisie). Capture d'écran prise sur `/register` : le texte "At least 8 characters…" apparaît désormais en gris neutre, plus en rouge.
- `axe-core` sur `/register` : 0 violation avant et après (pas de régression). TypeScript et build OK.

### 5.4 P1 — Deux boutons "afficher le mot de passe" au nom accessible identique
**Fichiers** : `web-app/src/components/ui/Field.tsx`, `web-app/src/locales/fr.ts`, `web-app/src/locales/en.ts`
**Changement** : nouvelles clés paramétrées `auth.showPasswordFor`/`auth.hidePasswordFor` (`"Afficher : {field}"`/`"Show: {field}"`), l'`aria-label` du bouton œil inclut désormais le libellé du champ.
**Preuve de vérification** : sur `/register`, les deux boutons portent maintenant `"Show: Password"` et `"Show: Confirm password"` (vérifié en lisant `aria-label` des deux `.password-toggle` en direct) — précédemment identiques. TypeScript et build OK.

### 5.5 P1 — Palette admin codée en dur (Web)
**Fichiers** : `web-app/src/styles/tokens.css` (nouveaux tokens `--admin-*`), `web-app/src/pages/admin/commerce/CommerceDashboardPage.tsx` (entièrement migré), `web-app/src/pages/admin/technical/TechnicalDashboardPage.tsx` (conteneur `SectionCard` migré)
**Changement** : 14 tokens `--admin-bg/surface/surface-2/border/border-soft/text/text-muted/text-faint/accent/success/success-soft/warning/danger/danger-soft/info` ajoutés sur `:root`, documentés comme "look toujours sombre, indépendant du thème clair/sombre — décision produit à confirmer, pas changée ici". `CommerceDashboardPage.tsx` n'a plus aucune couleur hex en dur. `TechnicalDashboardPage.tsx` : le conteneur `SectionCard` (répété sur chaque section de la page) est migré ; **la table de correspondance `StatusBadge` (15 statuts × 3 teintes) et le reste des couleurs conditionnelles par métrique n'ont pas été retouchés dans cette itération** — périmètre trop large pour être fiabilisé sans accès de test admin réel dans le temps imparti ; documenté comme dette P3 explicite plutôt que traité à la hâte.
**Preuve de vérification** : TypeScript OK, build OK (les deux fichiers compilent, `var(--admin-*)` est une chaîne CSS valide peu importe le composant). **Rendu non capturé** (pages derrière authentification admin) — la garantie ici est "même valeur hex, juste référencée via une variable", donc le risque visuel résiduel est quasi nul, mais non confirmé par capture.

### 5.6 P1 — Admin Android : header/fond codés en dur
**Fichiers** : `android/src/theme.ts` (nouvel export `adminDark`), `android/app/admin/_layout.tsx`
**Changement** : `adminDark = { headerBg: '#0f172a', headerTint: '#ffffff', contentBg: '#090d16' }` centralisé dans `theme.ts` ; `_layout.tsx` consomme ces trois valeurs au lieu de les répéter en dur. Rendu strictement identique (mêmes valeurs), seule la source de vérité change.
**Preuve de vérification** : `npx tsc --noEmit` sur `android/` → 0 erreur. `npx expo-doctor` → 21/21 vérifications passées. **Rendu non capturé** (nécessiterait de naviguer `/admin` sur le rendu React Native Web, non fait par manque de compte admin de test) — risque quasi nul (substitution de valeur identique) mais non confirmé visuellement.

### 5.7 P2 → corrigé, gated à `Platform.OS === 'web'` uniquement — "Welcome back" masqué par le header (Android)
**Fichier** : `android/app/auth/login.tsx`

Le correctif générique habituel (`useHeaderHeight()` de `@react-navigation/elements`) **n'est pas utilisable ici** : le projet n'a **aucune dépendance `@react-navigation/*` installée** (`node_modules/@react-navigation` absent — vérifié), cette version d'Expo Router (SDK 57) ne l'expose pas en dépendance directe. Un `paddingTop` deviné et appliqué sans condition aurait pu **régresser l'Android natif** si celui-ci réserve déjà correctement l'espace du header (ce qui est le comportement par défaut de React Navigation sur natif — le bug semble spécifique au rendu web de React Native Web, cf. §1).

**Changement effectué, sans ce risque** : mesure exacte de la hauteur du header en trop sur le rendu web (`getBoundingClientRect()` en direct sur `/auth/login` → exactement **64px**, qui correspond d'ailleurs à `--header-h` déjà utilisé côté Web — cohérence heureuse, pas forcée), puis ajout de :
```ts
const webHeaderOffset = Platform.OS === 'web' ? 64 : 0
// ... paddingTop: spacing.lg + webHeaderOffset
```
`Platform.OS === 'web'` garantit un **effet strictement nul sur Android/iOS natifs** — la valeur ajoutée est `0`, aucun changement de layout possible sur la plateforme qui compte le plus, tant que cela n'est pas vérifié sur device.

**Preuve de vérification (avant/après)** :
- Avant : capture d'écran (session précédente) — le haut du "W" de "Welcome back" est visuellement coupé sous le bandeau "Sign in".
- Après : rechargement de `http://localhost:19006/auth/login`, capture d'écran — "Welcome back" s'affiche entièrement, sous le header, sans chevauchement.
- `npx tsc --noEmit` sur `android/` → 0 erreur après ce changement.
- **Non vérifié** : rendu natif Android réel (aucun émulateur/device disponible) — mais le risque de régression y est nul par construction (`webHeaderOffset` vaut `0` hors web).

## 5.8 Liste consolidée des corrections, par priorité

**P0 — corrigés cette itération**
- [x] `<select>` de tri des avis sans nom accessible (§5.1)
- [x] Dashboard admin Direction : 3 chargements API silencieux → erreurs visibles + réessayer (§5.2)

**P1 — corrigés cette itération**
- [x] Hint de mot de passe stylé comme une erreur, sur tout formulaire de l'app (§5.3)
- [x] Deux boutons "afficher le mot de passe" au nom accessible identique (§5.4)
- [x] Admin Android : header/fond codés en dur → centralisés dans `theme.ts` (§5.6)
- [~] Palette admin Web codée en dur — **Commerce** entièrement migré, **Technical** partiellement (conteneur) (§5.5)

**P2 — traités ou tranchés cette itération**
- [x] "Welcome back" masqué par le header (Android/RN-Web) — corrigé sans risque de régression native (§5.7)
- [ ] `userInterfaceStyle: "light"` vs dark mode JS — **décision requise, non modifié** (§2, §6)
- [ ] Filtre "stock faible" appliqué après pagination serveur → résultats incomplets sans avertissement (`InventoryListPage.tsx`)

**P3 — dette documentée, non traitée cette itération**
- [ ] `TechnicalDashboardPage.tsx` : table `StatusBadge` (15 statuts × 3 teintes) et couleurs conditionnelles par métrique, à tokeniser
- [ ] `InventoryListPage.tsx` et probablement les pages admin non lues (`GlobalConfigPage`, `AdvancedManagementPage`, `FeatureFlagsPage`, `OrderListPage`…) : même palette codée en dur, à confirmer fichier par fichier puis tokeniser
- [ ] 3 réimplémentations indépendantes de la palette de statuts de stock (Commerce/Technical/Inventory) → extraire un composant `<StatusBadge/>` partagé
- [ ] Champs de filtre admin (`InventoryListPage`) sans `aria-label`
- [ ] Lien "N° commande" du dashboard vendeur vers la liste plutôt que le détail
- [ ] Suppression d'article panier sans confirmation/"Annuler"
- [ ] Stepper d'inscription sans indicateur de progression visuel
- [ ] Icônes emoji comme éléments d'interface (Commerce, Favoris) → remplacer par les SVG de `@/components/ui/Icons`
- [ ] Échelle typographique centralisée manquante côté Android (`theme.ts`)
- [ ] Harmoniser les échelles d'espacement Web/Android terme à terme

## 6. Décisions nécessitant votre approbation (non tranchées automatiquement)

1. **`userInterfaceStyle` dans `app.json`** — passer à `"automatic"` pour éviter un flash clair/sombre au démarrage natif, ou garder `"light"` si c'est un choix produit assumé (ex. contrainte App Store, cohérence de marque au premier lancement). Impact natif réel, non testable dans cet environnement.
2. **Admin toujours sombre (Web et Android)** — assumer explicitement "l'admin est une console technique, toujours en thème sombre, indépendant du choix de l'utilisateur" (et le documenter comme règle du design system), ou bien le faire suivre le thème clair/sombre comme le reste de l'app. Les corrections de cette itération **préservent le rendu sombre actuel** (elles centralisent les couleurs sans changer le comportement) — un changement de comportement attend votre décision.
3. **Pages admin non implémentées** (`CommerceDashboardPage` et probablement d'autres) — router un lien de menu vers une page 100% vitrine sans backend est un choix produit (roadmap visible) à confirmer avant de les masquer ou de les compléter.
