# Saved-Address Checkout — Real UI/E2E Validation Report
**Date:** 2026-09-15 | **Browser:** Chrome 125 headless, viewport 390×844 (mobile mode) | **Mobile:** Expo Web `localhost:8090` | **Status:** PASS

---

## 13-Line Test Matrix

| # | Test | Platform | Evidence | Result |
|---|------|----------|----------|--------|
| 1 | **T1 – First checkout saves address** | Web | `shots/01_t1_delivery_filled.png` → `03_t1_success.png`; profile API `Gombe/Avenue des Aviateurs/25` saved | **PASS** |
| 2 | **T2 – Saved-mode reuse** | Web | `shots/04_t2_saved_mode.png` → `05_t2_payment.png`; order placed via saved address, profile unchanged | **PASS** |
| 3 | **T3 – Temp address (profile unchanged)** | Web | `shots/06_t3_custom_temp.png` → `07_t3_payment_temp.png`; order street=`Avenue Kasavubu 2/99`, profile still `Avenue des Aviateurs/25` | **PASS** |
| 4 | **T4 – Cross-hierarchy province rejected (FR)** | Web | `shots/08_t4_fr_error.png`; Haut-Katanga province via interceptor → French backend error, no 500 | **PASS** |
| 5 | **T5 – Invalid building number rejected (FR)** | Web | `shots/09_t5_filled.png` → `10_t5_error.png`; `abc123` → French validation error, no order created | **PASS** |
| 6 | **T6 – Order snapshot is immutable** | Web | `shots/11_t7_order_detail.png`; profile changed post-order, delivery address in order still shows original snapshot | **PASS** |
| 7 | **T8 – Courier mission shows order delivery address** | Web | `shots/12_t8_courier_dashboard.png` → `15_t8_mission_detail_modal.png`; courier set AVAILABLE, assigned, dashboard shows `Avenue des Aviateurs, 25, Gombe, Kinshasa` + delivery_notes="Appeler avant de passer" | **PASS** |
| 8 | **M1 – Mobile first checkout (custom form)** | Mobile | `shots_mobile/02_m_delivery_page.png` → `05_m_order_detail_m1.png`; province/city/commune pickers + street/building/landmark filled, checkbox ON, profile saved | **PASS** |
| 9 | **M2 – Mobile saved-mode reuse** | Mobile | `shots_mobile/07_m_delivery_page.png` → `08_m_order_detail_m2.png`; "Adresse enregistrée" shown with `Avenue des Aviateurs, 25 / Gombe, Kinshasa`, reused without re-filling | **PASS** |
| 10 | **M3 – Mobile temp address (profile unchanged)** | Mobile | `shots_mobile/10_m_delivery_page.png` → `11_m_delivery_filled.png` → `12_m_payment.png`; saved summary → "Utiliser une autre adresse" → checkbox OFF → temp `Avenue Kasavubu 2/99` → order placed, profile unchanged | **PASS** |
| 11 | **T6 (sync) – Web & mobile show same saved address** | Both | Web M2 profile = `Gombe/Avenue des Aviateurs/25`; mobile M2 profile = `Gombe/Avenue des Aviateurs/25`; both from single shared `/buyer/profile` row | **PASS** |
| 12 | **Save-default behavior – ON for first checkout, OFF for edit** | Both | Web: T1 `checkbox.checked=true` (DOM), T3 `checked=false`; Mobile: M1 `background=green`, M3 `background=transparent` | **PASS** |
| 13 | **French error codes – backend validates & translates** | Web | T4: cross-hierarchy province error in FR; T5: building-format error in FR; both from `fr.json` keys (error code validation → localized message, no English fallback) | **PASS** |

---

## Aggregate

```
13 / 13  PASS
 0 / 13  FAIL
 0 / 13  PARTIAL
```

## Evidence files

- **Web screenshots:** `C:\Users\Dell\AppData\Local\Temp\opencode\e2e\shots\` (21 files, `01_t1_*` through `15_t8_*`)
- **Mobile screenshots:** `C:\Users\Dell\AppData\Local\Temp\opencode\e2e\shots_mobile\` (16 files, `01_m_*` through `12_m_*`)
- **Web E2E results JSON:** `e2e\web_results.json` (40/40 checks PASS)
- **Mobile E2E results JSON:** `e2e\mobile_results.json` (18/18 checks PASS)
- **Web driver:** `e2e\web_e2e.mjs`
- **Mobile driver:** `e2e\mobile_e2e.mjs`

## Key implementation details captured during E2E

- **Courier availability gate:** Courier invited/activated with `status=ACTIVE` but `availability=UNAVAILABLE`; courier must self-set via `PATCH /courier/availability {"availability":"AVAILABLE"}` before admin can assign (`backend/internal/service/admin_commerce_service.go:335-336`).
- **Courier phone uniqueness:** Invitation creates a user row; re-using the same phone across runs causes `phone_unique` violation → activation fails silently with generic `ACTIVATION_FAILED`. Driver uses random phone per run.
- **Mobile picker modal:** RN-Web `Modal` renders in DOM portal; `document.body.innerText.includes('Rechercher')` fails because search field uses `placeholder` attribute, not rendered text. Use `'Fermer'` (visible close button) as modal-open sentinel instead.
- **Mobile checkbox visual check:** `Ionicons` `checkmark` renders as font glyph via computed `backgroundColor` on the tick View — not detectable via `innerText`. Use `getComputedStyle(tickEl).backgroundColor` and verify `!= 'rgba(0, 0, 0, 0)'`.
- **Mobile prefilled custom form:** After profile loads, switching to "Utiliser une autre adresse" shows the custom form with all pickers pre-filled from profile (street/building also prefilled). No need to re-select province/city/commune when editing; only overwrite the changed fields.
- **React controlled inputs:** `HTMLInputElement.prototype.value` setter + dispatch `input`/`change`/`blur` events required; plain `page.type` appends to existing value.
- **Expo Web mobile driver:** `npx expo start --web --port 8090` in `android/`; tokens stored via AsyncStorage on web = plain localStorage keys (`btmi.access`, `btmi.refresh`, `btmi.lang`).
- **Web E2E quirks:** Puppeteer `page.evaluate` serializes functions — closure variables are undefined in browser scope; pass values via second argument array instead.
