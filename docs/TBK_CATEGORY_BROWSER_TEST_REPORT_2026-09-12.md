# TBK Market — Real-browser category test report

Date: 2026-09-12  
Environment: local Edge browser, frontend `127.0.0.1:5173`, local Go API `127.0.0.1:8080`, real development database

## Overall result

**PARTIAL PASS**

The rendered-field sweep covered all 11 active top-level categories and all 31 active subcategories (32 selectable category/subcategory combinations, including the top-level Shoes category). The focused validation, persistence, and publication scenarios passed for Food/Beverages and the Fashion/Shoes multi-variant path. A browser-extension failure prevented repeating the save/publish lifecycle independently for every remaining top-level category, so the overall result is not reported as a full pass.

## Inventory discovered from the live API

| Category | Active subcategories tested | Variant fields | Product fields |
|---|---|---|---|
| Fashion | Shoes, Clothing, Bags, Accessories | Shoes: Couleur*, Pointure*; others: Couleur*, Taille* | Shoes: Matière, Genre; others: Matière, Coupe |
| Children | Clothing, Toys, School, Baby Products | Taille, Couleur | Tranche d’âge |
| Electronics | Phones, Computers, TVs, Accessories | Stockage, Mémoire RAM, Capacité, Couleur | Modèle |
| Home | Furniture, Kitchen, Decoration | Couleur, Capacité | Dimensions, Matériau |
| Beauty | Skincare, Makeup, Haircare | Teinte, Volume, Parfum | Type de peau |
| Food | Beverages, Snacks, Bakery | Saveur, Poids, Volume, Format/Lot | Date de péremption* |
| Shoes | No active subcategory | Couleur*, Pointure* | Matière, Genre |
| Sport | Fitness, Outdoor, Team Sports | Taille, Couleur | Poids |
| Automotive | Parts, Tires, Accessories | Capacité, Taille/Diamètre | Modèle, Compatibilité |
| Services | Repair, Consulting, Delivery | None | None |
| Phase 2 E2E 20260904205715 | Verified Subcategory | None | None |

`*` means required by the database rule.

No duplicate dynamic field was observed in any of the 32 combinations.

## Field-type coverage

The active database contained `TEXT` and `DATE` definitions. Every active definition was rendered in the browser. `Date de péremption` rendered as a native `input[type=date]`; the other active definitions rendered as text inputs. The implementation now also maps database `SELECT`, `NUMBER`, and `BOOLEAN` definitions to suitable controls, although no active database category exposed those types during this run.

## Focused end-to-end scenarios

### Food / Beverages — PASS

- Left required `Date de péremption` empty and attempted publication.
- Publication was blocked with a named missing-field alert.
- `Compléter Date de péremption` scrolled to and focused the exact date input, with the completion highlight applied.
- Entered `2027-12-31`; the warning cleared.
- Publication succeeded.
- Authenticated API read-back confirmed status `PUBLISHED`, category Food/Beverages, one variant, and product attributes containing `Expiration Date: 2027-12-31`.

### Fashion / Shoes multi-variant validation — PASS

- Variant 1 contained Couleur `Noir` and Pointure `42`.
- Variant 2 contained Couleur `Blanc` but omitted Pointure.
- Publication was blocked.
- The alert identified `Variante 2 — Blanc` and the missing `Pointure` field.
- The completion action focused the exact Pointure input belonging to Variant 2.
- A subsequent final publication/read-back run was interrupted by the browser-extension failure, so only validation/navigation—not final persistence—is claimed for this scenario.

## Defects found and corrected

1. Optional database-defined product attributes appeared only as suggestion chips instead of real fields.
2. Product attributes from a previous category could remain after switching categories.
3. Dynamic controls did not respect database input types.
4. Product-level required-field errors lacked direct navigation and focus highlighting.
5. A single incomplete variant was described only by its attribute value, not its variant number.

The product form now seeds all product-level database definitions, removes stale database-backed rows on category changes, renders controls according to input type, focuses missing product fields, and labels incomplete variants as `Variante N — details`.

## Automated verification

- `npm run typecheck`: PASS
- `npm test -- --run src/lib/categoryAttributes.test.ts`: PASS (4/4)
- `go test ./internal/service -count=1`: PASS

## Remaining work for a strict full pass

Repeat missing-required-field, save/reload persistence, and final publication/read-back independently for each remaining top-level category. Also rerun the category-switch confirmation scenario in a responsive browser session to record explicit UI evidence that old attribute values cannot satisfy the newly selected category.
