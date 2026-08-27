# BTMI vs Flipkart — Comparaison UI section par section

**Date :** 2026-08-26
**Méthode :** inspection live de `flipkart.com` (accueil + page de résultats) et de BTMI (`localhost:5173`), comparaison structurelle du DOM et des données portées par chaque composant.

> Flipkart sert de **référentiel de structure commerciale**, pas de modèle graphique. Aucun asset, aucune couleur, aucun texte, aucune identité Flipkart n'est proposé à la reprise. BTMI garde son identité (vert foncé, accent doré, fond neutre chaud) et ses contraintes RDC (paiement cash, stock par boutique).

---

## 1. Page d'accueil

### Ce que fait Flipkart

Sa home n'est **pas** une grille de produits. C'est une page de merchandising :

| Ordre | Section | Nature |
|---|---|---|
| 1 | Barre de localisation | « Select delivery location » — persistante en haut |
| 2 | Header : recherche + Login + Panier + « Become a Seller » | La recherche occupe le centre |
| 3 | Rail de catégories horizontal | For You, Fashion, Mobiles, Electronics, Beauty, Home Appliances, Toys, Food & Health, Auto… |
| 4 | « Trending Gadgets & Appliances » | Vignettes catégorie + accroche promo (« Min. 50% Off ») |
| 5 | « Trends you may like » | Tendances éditorialisées |
| 6 | « Top Value Deals » | Promotions |
| 7 | « Brands in Spotlight » | Mise en avant marques |
| 8 | « Rakshabandhan Specials » | Saisonnier / événementiel |
| 9 | « Home Decor & Furnishing » | Univers thématique |

**Le point structurel important :** chaque section est un **rail horizontal scrollable** avec un titre. Les vignettes sont des portes d'entrée (catégorie + accroche promo), pas des fiches produit. L'objectif est d'orienter, pas de vendre directement depuis la home.

### Ce que fait BTMI aujourd'hui

`HomePage.tsx` fait 69 lignes et rend **deux** sections :
1. Un bandeau statique « Achetez en toute confiance »
2. Des chips de catégories
3. Une grille produits unique (`limit: 16, sort: relevance`)

### Écart

BTMI n'a **aucune notion d'éditorialisation**. Pas de promo mise en avant, pas de tendance, pas de saisonnier, pas de boutiques en vedette. Un acheteur qui arrive voit 16 produits arbitraires.

### À ajouter — par ordre de faisabilité

| # | Section | Donnée backend | Existe déjà ? |
|---|---|---|---|
| A1 | **Rail « Offres du moment »** | `discount_active` + fenêtre `discount_start/end` | ✅ oui, en base |
| A2 | **Rail « Boutiques populaires »** | `ranking_score` (`ranking_repository`) | ✅ oui |
| A3 | **Rail « Vus récemment »** | localStorage côté client | ✅ aucun backend requis |
| A4 | **Rail par univers de catégorie** | `GET /marketplace/categories/:slug/products` | ✅ oui |
| A5 | Bandeau de localisation de livraison | `buyer_profiles.city/commune` | ✅ oui |
| A6 | Recommandations personnalisées | — | ❌ nécessite données comportementales |

**A1 à A4 sont réalisables sans une seule migration.** C'est le meilleur rapport valeur/effort de toute la comparaison.

---

## 2. Page de résultats — l'écart le plus grave

### Ce que fait Flipkart

Rail de filtres à gauche, **9 facettes** :

```
CATEGORIES        (affine dans le résultat : Footwear → Men's / Women's / Kids')
BRAND             (avec « 3982 MORE »)
GENDER
COLOR             (avec « 26 MORE »)
SIZE
PRICE             (bornes min/max sélectionnables)
DISCOUNT          (30% ou plus / 40% / 50% / 60% / 70%)
CUSTOMER RATINGS  (4★ et plus / 3★ et plus)
OFFERS            (Buy More Save More / Special Price)
AGE GROUP · NEW ARRIVALS · AVAILABILITY · COUNTRY OF ORIGIN
```

Plus : fil d'Ariane, compteur explicite (« Showing 1 – 40 of 8 808 results »), 5 tris (Relevance, Popularity, Price ↑, Price ↓, Newest First).

### Ce que fait BTMI

Mesuré en direct sur `/search?q=shoe` :

```
facettes présentes : 0
tris : 4  (Relevance, Price low→high, Price high→low, Top sellers)
compteur : « 9 results »
fil d'Ariane : absent
```

### Écart

**Zéro facette.** L'acheteur ne peut filtrer ni par prix, ni par note, ni par disponibilité, ni par catégorie, ni par boutique. Sur un catalogue qui grandit, la seule option est de faire défiler.

### À ajouter

| # | Facette | Donnée | Complexité |
|---|---|---|---|
| B1 | **Prix (min/max)** | `products.unit_price` | S |
| B2 | **Disponibilité** | `inventory.available` | S |
| B3 | **Catégorie / sous-catégorie** | `category_id`, `subcategory_id` | S |
| B4 | **Boutique** | `shop_id` | S |
| B5 | **Remise** (X% et plus) | `discount_active` + valeur | S |
| B6 | **Note client** (4★ et plus) | ⚠️ dépend de C1 ci-dessous | M |
| B7 | **Attributs de variante** (Couleur, Taille…) | `product_variants.attributes` JSONB | M |
| B8 | Fil d'Ariane + compteur détaillé | — | S |
| — | Marque | ❌ **aucun champ `brand` en base** | — |

**Note importante sur B7 :** BTMI a ici un atout que Flipkart n'a pas structurellement. Comme les attributs de variante sont libres et définis par le vendeur (`{"Color":"Black","Shoe Size":"41"}`), les facettes peuvent être **générées dynamiquement selon la catégorie** : Couleur/Pointure pour les chaussures, Parfum/Volume pour l'alimentaire, Stockage/RAM pour l'électronique. C'est exactement l'architecture déjà en place — il suffit de l'exposer en filtre.

**Sur la marque :** ne pas ajouter un champ `brand` à la légère. Dans le contexte RDC, beaucoup de vendeurs revendent sans marque identifiée. Une alternative plus juste : laisser « Marque » être un attribut INFO parmi d'autres, et le filtre B7 la couvre automatiquement quand le vendeur la renseigne.

---

## 3. La carte produit

### Anatomie Flipkart

```
URBANBOX                          ← marque, ligne séparée au-dessus du titre
Latest Trending Casual Runni…     ← titre tronqué
₹180  ₹999  81% off               ← prix effectif · prix barré · % de remise
Hot Deal / Value 365              ← badge d'offre
Only 1 left / Only few left       ← signal de rareté
```

### Anatomie BTMI (mesurée)

```
♡                    ← favori
SHOES                ← chip catégorie
Running Shoe Test    ← nom
In stock             ← état de stock
25 000 FC            ← prix
```

### Écart

| Élément | Flipkart | BTMI |
|---|---|---|
| Image | ✅ lazy + responsive | ✅ lazy |
| Titre | ✅ | ✅ |
| Prix effectif | ✅ | ✅ |
| Prix barré + % remise | ✅ | ✅ (si remise active) |
| **Note ★ + nombre d'avis** | ✅ | ❌ **absent partout** |
| **Nom de la boutique / vendeur** | ✅ (marque) | ❌ absent de la carte |
| **Signal de rareté** | ✅ « Only 1 left » | ⚠️ « In stock » seulement |
| Badge d'offre | ✅ | ⚠️ % OFF uniquement |
| Favori | ❌ | ✅ **BTMI est devant** |
| État de stock explicite | ⚠️ | ✅ **BTMI est devant** |

### À ajouter

| # | Élément | Blocage |
|---|---|---|
| **C1** | **Note moyenne + nombre d'avis** | ⚠️ `PublicProduct` ne porte **aucun agrégat de note** → changement backend requis |
| C2 | Nom de la boutique sur la carte | ✅ `shop_name` déjà présent dans la réponse |
| C3 | Rareté (« Plus que 3 ») | ✅ `availability` / stock déjà présent |
| C4 | Badge « Nouveau » | ✅ `created_at` déjà présent |

**C1 est le point le plus important de toute cette comparaison.** Les avis existent, sont réels et liés à un achat vérifié — mais ils sont **invisibles** tant que l'acheteur n'est pas déjà sur la fiche produit. Sur la home, la recherche, les catégories, la page boutique et les produits similaires : aucune étoile nulle part. C'est le signal de confiance qui manque exactement là où l'acheteur décide.

⚠️ **Piège technique :** ne pas calculer la note par sous-requête par ligne dans les listes. Utiliser un compteur dénormalisé mis à jour à l'écriture d'un avis, ou une vue matérialisée. L'agrégat `shop_review_aggregates` existe déjà pour les boutiques — la même approche s'applique aux produits.

---

## 4. Header et navigation

| Élément | Flipkart | BTMI |
|---|---|---|
| Recherche centrale proéminente | ✅ | ✅ |
| Autocomplétion | ✅ | ⚠️ existe, **côté client uniquement** |
| Recherches récentes / populaires | ✅ | ❌ non stockées |
| Rail de catégories horizontal | ✅ | ✅ (chips) |
| Panier avec compteur | ✅ | ✅ |
| Localisation de livraison | ✅ | ❌ |
| Lien « Devenir vendeur » | ✅ | ✅ (footer) |
| **Recherche par image** | ❌ | ✅ **BTMI est devant** (ONNX MobileNetV2) |

**La recherche visuelle est un vrai différenciateur** que Flipkart n'a pas sur le web. Elle est actuellement enterrée — elle mériterait d'être visible dans le header plutôt que découverte par hasard.

### À ajouter
- **D1** Recherches récentes (localStorage, aucun backend)
- **D2** Autocomplétion serveur avec suggestions de produits/catégories réelles
- **D3** Sélecteur de ville de livraison dans le header
- **D4** Rendre la recherche par image visible (icône appareil photo dans la barre)

---

## 5. Ce que BTMI fait **mieux** que Flipkart

Il serait malhonnête de présenter cette comparaison comme un rattrapage à sens unique :

| Domaine | Avantage BTMI |
|---|---|
| **Variantes** | Schéma défini par le vendeur, rendu dynamiquement. Flipkart impose des attributs fixes par catégorie. L'approche BTMI est plus souple et déjà en production. |
| **Stock** | Réservation atomique en SQL — survente structurellement impossible. |
| **Paiement** | Double confirmation cash (acheteur déclare / vendeur confirme). Adapté au marché RDC, aucun équivalent Flipkart. |
| **Recherche visuelle** | Présente sur BTMI, absente du web Flipkart. |
| **Favoris sur la carte** | Accessible directement depuis la grille. |
| **Stock explicite** | « In stock » / « Only X left » affiché clairement plutôt que déduit. |

**Ne pas régresser sur ces points en cherchant à ressembler à Flipkart.**

---

## 6. Ce qu'il ne faut **pas** reprendre

| Pattern Flipkart | Pourquoi l'éviter |
|---|---|
| Densité extrême de bannières promo | Coût réseau élevé — pénalisant sur connexions RDC |
| Remises de 80 % affichées partout | Détruit la crédibilité du prix ; peu compatible avec des marges de détaillants locaux |
| Modale de login bloquante à l'arrivée | Nuit à la découverte ; BTMI laisse parcourir librement — c'est mieux |
| Titres surchargés de mots-clés | Bruit ; ce n'est pas une pratique à encourager côté vendeurs |
| Facettes « Country of Origin », « Age Group » | Non pertinentes pour le catalogue BTMI actuel |
| Palette bleu/jaune, logo, typographie | Identité propriétaire — BTMI garde vert foncé + or |

---

## 7. Priorisation proposée

### P1 — Fort impact, réalisable sans migration

| # | Action | Effort |
|---|---|---|
| B1–B5 | Facettes prix, disponibilité, catégorie, boutique, remise | M |
| A1 | Rail « Offres du moment » sur la home | S |
| A2 | Rail « Boutiques populaires » | S |
| A3 | Rail « Vus récemment » | S |
| C2 | Nom de boutique sur la carte produit | S |
| C3 | Signal de rareté sur la carte | S |
| D1 | Recherches récentes | S |
| B8 | Fil d'Ariane + compteur détaillé | S |

### P1 — Fort impact, **changement backend requis**

| # | Action | Effort |
|---|---|---|
| **C1** | **Agrégat de note sur `PublicProduct` → étoiles partout** | M |
| B6 | Facette « note 4★ et plus » (dépend de C1) | S après C1 |

### P2

| # | Action |
|---|---|
| B7 | Facettes dynamiques par attribut de variante |
| D2 | Autocomplétion serveur |
| D3 | Sélecteur de ville de livraison |
| D4 | Recherche par image visible dans le header |
| A4 | Rails par univers de catégorie |

### P3
- Index `pg_trgm` pour tolérance aux fautes de frappe
- Badge « Nouveau » (C4)
- Recommandations personnalisées (A6) — nécessite du comportemental

---

## 8. Ordre d'implémentation recommandé

```
1. C1  Agrégat de note backend        → débloque les étoiles ET la facette note
2. C2 + C3  Enrichir la carte produit  → bénéficie à home, recherche, catégorie, boutique
3. B1–B5 + B8  Rail de facettes
4. A1–A3  Rails de découverte sur la home
5. B6  Facette note
6. B7  Facettes dynamiques par variante
```

**C1 en premier** parce que c'est le seul élément qui exige un changement de contrat backend et qui débloque simultanément deux points P1. Tout le reste est du frontend sur des données déjà disponibles.

---

## 9. Fichiers concernés

**C1 (agrégat de note)**
- `backend/internal/models/marketplace.go` — champs `average_rating`, `total_reviews` sur `PublicProductResponse`
- `backend/internal/repository/marketplace_repository.go` — jointure agrégat (pas de sous-requête par ligne)
- Nouvelle migration : table/vue d'agrégat par produit
- `web-app/src/api/types.ts`, `web-app/src/components/ui/ProductCard.tsx`
- `android/src/types.ts`, `android/src/components/` — parité mobile

**B1–B8 (facettes)**
- `backend/internal/handlers/marketplace/` — paramètres de filtre
- `backend/internal/repository/marketplace_repository.go` — clauses `WHERE`
- `web-app/src/pages/marketplace/SearchPage.tsx` + nouveau composant rail de facettes
- `web-app/src/pages/marketplace/CategoryBrowsePage.tsx` — même rail

**A1–A4 (home)**
- `web-app/src/pages/marketplace/HomePage.tsx`
- `web-app/src/api/marketplace.ts`
- Aucun changement backend

---

**Aucune implémentation effectuée. En attente d'arbitrage sur la priorisation.**
