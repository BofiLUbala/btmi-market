# Recherche marketplace — pertinence, classement, analytique, SEO

Source de vérité des poids : `backend/internal/search/scoring.go`.
SQL : `backend/internal/repository/marketplace_search.go`.
Migration : `backend/migrations/104_marketplace_search_relevance.sql`
(rollback manuel : `backend/migrations/rollback/104_marketplace_search_relevance.down.sql`).

## Pipeline

1. **Analyse de la requête** (`internal/search`) : minuscules, accents et
   ligatures retirés, ponctuation → espace, 120 caractères max, mots vides
   français retirés, pluriels simples repliés (`chaussures → chaussure`,
   `bateaux → bateau`, jamais sur les mots contenant des chiffres), 6 mots max.
   Chaque mot reçoit ses alternatives : lui-même, son singulier, ses synonymes
   (table `search_synonyms`, gérée depuis l'admin, cache mémoire 5 min,
   indépendant de Redis). Nouvelle langue : `search.RegisterAnalyzer("ln", …)`.
2. **Candidats** : table `product_search_documents` (un document normalisé par
   produit, tenue à jour par triggers) + index trigram GIN. Chaque mot doit être
   trouvé (ET entre mots, OU entre alternatives). Les noms de boutique ne sont
   pas dans les documents : le catalogue d'un vendeur n'est inclus que si la
   requête est le début du nom de sa boutique ou de son entreprise.
3. **Visibilité** (toujours en direct) : produit `PUBLISHED` + `ACTIVE`, au moins
   une variante active avec une ligne d'inventaire dans une boutique `ACTIVE`
   d'une entreprise `ACTIVE`. Règle stock : un produit à stock 0 reste visible
   (comportement existant, page produit « rupture ») mais passe après les
   produits aussi pertinents disponibles (bonus disponibilité).
4. **Passe approximative** : seulement si la passe exacte ne trouve rien —
   seuils trigram abaissés (`word_similarity ≥ 0.45`), réponse
   `match_mode: "approximate"`, message « résultats les plus proches ».
5. **Élagage + classement** sur au plus 2 000 candidats (profondeur maximale de
   pagination), sous-ensemble déterministe identique pour toutes les pages.
6. **Dédoublonnage** : une ligne par produit ; meilleure offre = boutique avec du
   stock, puis ville demandée (`near_city`), puis stock le plus élevé, puis id.

## Formule produit

```
final_score = palier + proximité + bonus
```

| Palier | Valeur |
|---|---|
| nom exact | 12000 |
| nom commençant par la requête | 11000 |
| tous les mots = mots entiers du nom | 10000 |
| SKU / code-barres exact | 9000 |
| tous les mots dans le nom (partiel) | 8000 |
| attributs de variante (couleur, taille, modèle…) | 7000 |
| catégorie / sous-catégorie | 6000 |
| nom de boutique / entreprise (préfixe) | 5000 |
| description | 4000 |
| synonyme uniquement | 3000 |
| approximatif | 0–2000 |

Requête de plusieurs mots : palier du mot le plus faible.
**Proximité** : `min(floor(similarity(nom, requête) × 5), 4) × 100` (0–400).

| Bonus (plafonnés) | Max |
|---|---|
| disponible | 20 |
| qualité de fiche (image 6, description ≥ 40 car. 4, catégorie+sous-cat. 2) | 12 |
| avis vérifiés (moyenne bayésienne, a priori 3,5 × 5 avis) | 15 |
| vendeur TRUSTED | 10 |
| ville proche (`near_city`) | 10 |
| niveau vendeur (`search_boost` 0–1 × 8) | 8 |
| ventes 90 j livrées/terminées (`ln(1+n) × 2,5`) | 10 |
| créé < 30 jours | 5 |
| pénalité LOW / SUSPENDED | −20 / −40 |

Invariants testés (`TestCommercialBonusCannotCrossTier`) : bonus max (90) < un
cran de proximité (100) ; proximité max + bonus < écart de palier (1000). Les
points vendeur ne peuvent jamais faire passer un produit moins pertinent devant.
Départage stable : `final_score DESC, id ASC`.

## Boutiques (classement séparé)

Paliers : nom exact 1200, préfixe 1100, mots entiers 1000, partiel 800, nom
d'entreprise 700, ville 600, boutiques vendant des produits correspondants en
stock 500 + jusqu'à 40, approximatif ≤ 300. Bonus : avis ≤ 15, TRUSTED 10 /
LOW −20 / SUSPENDED −40, taux d'annulation jusqu'à −10, catalogue (taille +
part avec images) ≤ 10, ville proche 10, niveau ≤ 8.

## API (ajouts rétro-compatibles)

- `GET /marketplace/search` : nouveaux paramètres optionnels `near_city`,
  `session` ; réponse enrichie de `search_id`, `match_mode`, `normalized_query`,
  `products[].search_rank` ; `pagination.has_more` désormais rempli.
  Erreurs 400 : `QUERY_TOO_LONG` (> 1000 octets), `INVALID_PAGE`, `INVALID_FILTER`.
- `GET /marketplace/search/suggest?q=&limit=` : produits, boutiques, catégories,
  sous-catégories en une requête (même moteur que la page).
- `POST /marketplace/search/events` : `CLICK` / `ADD_TO_CART`.
- `GET /marketplace/shops` : même format, classement boutique.
- Admin : `GET/PUT /admin/commerce/search/synonyms`,
  `DELETE /admin/commerce/search/synonyms/:term`, statistiques enrichies.
- SEO : `/api/v1/seo/robots.txt`, `/api/v1/seo/sitemap.xml` (nginx : `/robots.txt`, `/sitemap.xml`).
- Rate limit en mémoire (3 req/s, rafale 30 par IP) sur recherche/suggest/events/shops.

## Vie privée

Journal : requête, requête normalisée, filtres essentiels, nombre de résultats,
ids du premier écran, mode, durée, identifiant de session aléatoire par onglet
(web) / par lancement (Android). Aucun id utilisateur, IP ou appareil stocké.

## Sponsorisé

Aucun mécanisme publicitaire n'existe. Point d'intégration prévu : ajouter une
source d'offres sponsorisées **pertinentes** (même condition de correspondance
`termMatchSQL`, palier minimum requis, p. ex. ≥ 6000) fusionnée *après* le
classement naturel dans `MarketplaceService.SearchProducts`, à des positions
fixes (ex. 3 et 8, jamais 1), avec un champ `sponsored: true` affiché
« Sponsorisé ». Le score naturel ne doit jamais inclure d'enchère.

## SEO

SPA rendue côté client : Googlebot exécute le JS et lit titre, description,
canonical, Open Graph et JSON-LD (`Product`/`Offer`/`AggregateRating`,
`Store`) posés par `web-app/src/lib/pageMeta.ts` ; les robots d'aperçu de liens
ne les voient pas. Recommandation : pré-rendu des pages `/products/:id`,
`/shops/:id`, `/categories/:slug` (service de prerender derrière nginx pour les
user-agents robots, ou migration SSR) ; sitemap index au-delà de 50 000 URL.
Le classement Google est indépendant du classement interne.
