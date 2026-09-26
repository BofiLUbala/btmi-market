"""Live simulation of the Admin Finance module against a running API.

Creates real orders through the buyer API, settles them through a signed
provider webhook (the same path a real mobile-money payment takes), then reads
every Finance Admin surface back and checks the money adds up, sub-feature by
sub-feature. Every config it touches is restored at the end.
"""
import datetime as dt
import hashlib
import hmac
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get("BASE", "http://localhost:8099/api/v1")
SECRET = os.environ.get("SECRET", "sim-webhook-secret")
PROVIDER = "MPESA"
STAMP = str(int(time.time()))
TOL = 0.011

results = []  # (section, name, ok, detail)
section = ""


def sec(name):
    global section
    section = name
    print(f"\n== {name} ==")


def check(name, ok, detail=""):
    results.append((section, name, bool(ok), detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}  {detail}")
    return ok


def near(a, b):
    return abs(float(a) - float(b)) <= TOL


def call(method, path, body=None, token=None, headers=None, raw=False):
    data = None if body is None else json.dumps(body).encode()
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    if headers:
        h.update(headers)
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = r.read().decode()
            status = r.status
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        status = e.code
    try:
        js = json.loads(txt) if txt else {}
    except ValueError:
        js = {"_raw": txt}
    return status, js


def D(js):
    """Unwrap the {data: ...} envelope some endpoints use."""
    if isinstance(js, dict) and "data" in js and len(js) <= 3:
        return js["data"]
    return js


def get(path, token, **q):
    qs = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in q.items() if v is not None)
    return call("GET", path + ("?" + qs if qs else ""), token=token)


def login_admin(email, pwd="TestAdmin@2025!"):
    s, js = call("POST", "/admin/auth/login", {"email": email, "password": pwd})
    return D(js).get("access_token") if s == 200 else None


def login_user(email, pwd="StrongPassword123!"):
    s, js = call("POST", "/auth/login", {"email": email, "password": pwd})
    return D(js).get("access_token") if s == 200 else None


def webhook(body_dict, sig=None):
    body = json.dumps(body_dict).encode()
    signature = sig or "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    req = urllib.request.Request(BASE + "/webhooks/payments/" + PROVIDER, data=body, method="POST",
                                 headers={"Content-Type": "application/json", "X-TBK-Signature": signature})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# --------------------------------------------------------------------------
sec("CONNEXIONS & RBAC")
FIN = login_admin("finance.test@tbkmarket.com")
DIR = login_admin("direction.test@tbkmarket.com")
COM = login_admin("commerce.test@tbkmarket.com")
BUYER = login_user("buyer_rt_1789261221@test.com")
SELLER = login_user("seller_rt_1789261221@test.com")
check("finance admin, direction, commerce, buyer, seller connectés", all([FIN, DIR, COM, BUYER, SELLER]))
_, me = call("GET", "/admin/auth/me", token=FIN)
FIN_ID = (D(me).get("id") or D(me).get("admin", {}).get("id"))
for label, tok in (("commerce", COM), ("direction", DIR)):
    s, _ = get("/admin/finance/dashboard", tok)
    check(f"{label} admin bloqué sur /finance/dashboard", s == 403, f"HTTP {s}")
s, _ = get("/admin/finance/dashboard", SELLER)
check("jeton vendeur refusé sur finance admin", s in (401, 403), f"HTTP {s}")
s, _ = get("/admin/finance/dashboard", None)
check("sans jeton refusé", s == 401, f"HTTP {s}")

# --------------------------------------------------------------------------
sec("CONTEXTE VENDEUR / PRODUIT")
_, js = get("/businesses", SELLER)
BIZ = D(js)[0]["id"]
_, js = get(f"/businesses/{BIZ}/shops", SELLER)
SHOP = D(js)[0]["id"]
_, js = get(f"/businesses/{BIZ}/products", SELLER)
PROD = D(js)[0]["id"]
_, js = get(f"/businesses/{BIZ}/products/{PROD}/variants", SELLER)
VARIANT = D(js)[0]["id"]
_, js = call("GET", "/auth/me", token=SELLER)
SELLER_UID = D(js).get("id") or D(js).get("user", {}).get("id")
call("POST", f"/shops/{SHOP}/stock", {"variant_id": VARIANT, "quantity": 40, "notes": "finance sim"}, SELLER)
_, prov = get("/locations/provinces", None)
KIN = [x["id"] for x in D(prov)["items"] if x["name"] == "Kinshasa"][0]
_, cities = get(f"/locations/provinces/{KIN}/cities", None)
CITY = D(cities)["items"][0]["id"]
_, com = get(f"/locations/cities/{CITY}/communes", None)
GOMBE = [x["id"] for x in D(com)["items"] if x["name"] == "Gombe"][0]
check("business/shop/produit/variante résolus", all([BIZ, SHOP, PROD, VARIANT, SELLER_UID]),
      f"biz={BIZ[:8]} shop={SHOP[:8]} seller={str(SELLER_UID)[:8]}")

TODAY = dt.date.today().isoformat()
YESTERDAY = (dt.date.today() - dt.timedelta(days=1)).isoformat()


def snapshot(**filters):
    _, js = get("/admin/finance/dashboard", FIN, **filters)
    return D(js)


def make_order(qty, method, tag):
    s, js = call("POST", "/buyer/orders", {"shop_id": SHOP, "items": [{"product_id": PROD, "variant_id": VARIANT, "quantity": qty}],
                                           "use_points": False, "idempotency_key": f"finsim-{STAMP}-{tag}"}, BUYER)
    oid = D(js)["order"]["id"]
    onum = D(js)["order"]["order_number"]
    call("POST", f"/buyer/orders/{oid}/delivery", {"method": "TBK_STANDARD", "use_points_for_delivery": False,
                                                    "contact_name": "Finance Sim", "phone": "+243810000001", "province_id": KIN,
                                                    "city_id": CITY, "commune_id": GOMBE, "street": "Avenue des Aviateurs",
                                                    "building_number": "25"}, BUYER)
    call("POST", f"/buyer/orders/{oid}/payment", {"payment_method": method, **({"provider": PROVIDER, "payer_phone": "+243810000001"} if method == "MOBILE_PAY_NOW" else {})}, BUYER)
    s, js = get(f"/buyer/orders/{oid}/payment", BUYER)
    return {"id": oid, "number": onum, "pay": D(js), "qty": qty}


def settle(o, event_id=None):
    p = o["pay"]
    return webhook({"event_id": event_id or f"finsim-{STAMP}-{o['number']}", "payment_id": p["id"],
                    "reference": f"PSP-{o['number']}", "status": "SUCCEEDED", "amount": p["final_total"],
                    "currency": p["currency"]})


# --------------------------------------------------------------------------
sec("T0 - INSTANTANES AVANT SIMULATION")
_, cfg = get("/admin/finance/commission-config", FIN)
RATE0 = float(D(cfg)["rate"])
before_g = snapshot()
before_shop = snapshot(shop_id=SHOP)
before_seller = snapshot(seller_id=SELLER_UID)
_, sj = get("/seller/finances/dashboard", SELLER)
before_seller_self = D(sj)
_, ts0 = get("/admin/finance/timeseries", FIN, interval="day")
_, fs0 = get("/admin/finance/summary", FIN)
fs0 = D(fs0)
check("taux de commission lu", RATE0 >= 0, f"{RATE0}%")
print(f"  gross={before_g['gross_sales']} comm={before_g['commission_amount']} net={before_g['seller_net_amount']} "
      f"paid={before_g['payments_collected']} due={before_g['payments_due']}")

# --------------------------------------------------------------------------
sec("SIMULATION - 3 paiements mobiles + 1 cash a la livraison")
orders = [make_order(q, "MOBILE_PAY_NOW", f"m{q}") for q in (1, 2, 3)]
cash = make_order(1, "CASH_ON_DELIVERY", "c1")
for o in orders + [cash]:
    p = o["pay"]
    ident = near(p["final_total"], float(p["products_final_total"]) + float(p["delivery_fee_final"]) + float(p["payment_markup"]))
    check(f"{o['number']} total = produits + livraison + majoration", ident,
          f"{p['products_final_total']} + {p['delivery_fee_final']} + {p['payment_markup']} = {p['final_total']} {p['currency']} [{p['status']}]")
check("cash à la livraison reste DUE (pas payé d'avance)", cash["pay"]["status"] == "DUE", cash["pay"]["status"])

mid = snapshot()
exp_due_before_settle = sum(float(o["pay"]["cash_due"]) for o in orders + [cash])
check("avant règlement: 'paiements dus' += les 4 commandes",
      near(float(mid["payments_due"]) - float(before_g["payments_due"]), exp_due_before_settle),
      f"delta {float(mid['payments_due']) - float(before_g['payments_due']):.2f} attendu {exp_due_before_settle:.2f}")
check("avant règlement: aucune commission créée", near(mid["gross_sales"], before_g["gross_sales"]))

# signature forgée & mauvais montant ne doivent rien créer
s, _ = webhook({"event_id": f"forged-{STAMP}", "payment_id": orders[0]["pay"]["id"], "status": "SUCCEEDED",
                "amount": orders[0]["pay"]["final_total"], "currency": "USD"}, sig="sha256=deadbeef")
check("webhook à signature forgée refusé", s == 401, f"HTTP {s}")
s, body = webhook({"event_id": f"badamt-{STAMP}", "payment_id": orders[0]["pay"]["id"], "status": "SUCCEEDED",
                   "amount": 0.5, "currency": "USD"})
check("webhook au mauvais montant refusé", "AMOUNT_MISMATCH" in body, f"HTTP {s}")

# règlement; le 3e reçoit 5 webhooks concurrents (retries du PSP en parallèle)
settle(orders[0])
settle(orders[1])
threads = [threading.Thread(target=settle, args=(orders[2], f"finsim-{STAMP}-dup-{i}")) for i in range(5)]
[t.start() for t in threads]
[t.join() for t in threads]
settle(orders[0])  # rejeu du même événement

after_g = snapshot()
exp_gross = sum(float(o["pay"]["products_final_total"]) for o in orders)
exp_comm = sum(round(float(o["pay"]["products_final_total"]) * RATE0 / 100 + 1e-9, 2) for o in orders)
exp_paid = sum(float(o["pay"]["cash_due"]) for o in orders)
dg = float(after_g["gross_sales"]) - float(before_g["gross_sales"])
dc = float(after_g["commission_amount"]) - float(before_g["commission_amount"])
dn = float(after_g["seller_net_amount"]) - float(before_g["seller_net_amount"])
check("CA brut += produits des 3 ventes (hors livraison)", near(dg, exp_gross), f"delta {dg:.2f} attendu {exp_gross:.2f}")
check(f"commission TBK += {RATE0}% de chaque vente", near(dc, exp_comm), f"delta {dc:.2f} attendu {exp_comm:.2f}")
check("net vendeur = brut - commission", near(dn, dg - dc), f"{dg:.2f} - {dc:.2f} = {dn:.2f}")
check("commission due += (rien encore encaissé)",
      near(float(after_g["due_commission"]) - float(before_g["due_commission"]), exp_comm))
check("ventes vérifiées +3 (5 webhooks concurrents = 1 seule commission)",
      int(after_g["verified_sales"]) - int(before_g["verified_sales"]) == 3,
      f"+{int(after_g['verified_sales']) - int(before_g['verified_sales'])}")
check("unités vendues +6", int(after_g["units_sold"]) - int(before_g["units_sold"]) == 6,
      f"+{int(after_g['units_sold']) - int(before_g['units_sold'])}")
check("paiements encaissés += montant payé (livraison + majoration incluses)",
      near(float(after_g["payments_collected"]) - float(before_g["payments_collected"]), exp_paid),
      f"delta {float(after_g['payments_collected']) - float(before_g['payments_collected']):.2f} attendu {exp_paid:.2f}")
check("encaissé mobile += même montant, cash inchangé",
      near(float(after_g["collected_mobile"]) - float(before_g["collected_mobile"]), exp_paid)
      and near(after_g["collected_cash"], before_g["collected_cash"]))
check("paiements dus: il ne reste que la commande cash",
      near(float(after_g["payments_due"]) - float(before_g["payments_due"]), float(cash["pay"]["cash_due"])))
check("encaissé cash + mobile = encaissé total",
      near(float(after_g["collected_cash"]) + float(after_g["collected_mobile"]), after_g["payments_collected"]))
prov = {p["provider"]: p for p in after_g.get("collected_by_provider") or []}
check("ventilation par opérateur contient MPESA", PROVIDER in prov)
check("identité globale brut - commission = net",
      near(float(after_g["gross_sales"]) - float(after_g["commission_amount"]), after_g["seller_net_amount"]))

# --------------------------------------------------------------------------
sec("HISTORIQUE DES VENTES / DETAIL / PAIEMENTS")
comm_ids = {}
for o in orders:
    s, js = get("/admin/finance/commissions", FIN, search=o["number"])
    rows = D(js)["commissions"]
    ok = len(rows) == 1
    if ok:
        r = rows[0]
        comm_ids[o["number"]] = r["id"]
        ok = (r["status"] == "DUE" and near(r["commission_rate"], RATE0) and r["total_quantity"] == o["qty"]
              and near(r["gross_amount"], o["pay"]["products_final_total"]) and r["payment_status"] in ("PAID", "VERIFIED")
              and r["provider"] == PROVIDER and len(r["lines"]) >= 1)
    check(f"liste commissions: {o['number']} (1 ligne, DUE, qté {o['qty']}, taux {RATE0}%)", ok)
    s, js = get(f"/admin/finance/commissions/order/{o['id']}", FIN)
    d = D(js)
    ok = s == 200 and near(float(d["products_subtotal"]) + float(d["delivery_fee"]) + float(d["payment_markup"]), d["final_total"]) \
        and near(float(d["sale"]["gross_amount"]) - float(d["sale"]["commission_amount"]), d["sale"]["seller_net_amount"]) \
        and near(sum(float(l["gross_amount"]) for l in d["lines"]), d["sale"]["gross_amount"])
    check(f"détail vente {o['number']}: lignes = brut, total = produits+livraison+majoration", ok)
s, js = get(f"/admin/finance/commissions/order/{cash['id']}", FIN)
check("détail vente d'une commande non payée -> 404 COMMISSION_NOT_FOUND", s == 404, f"HTTP {s}")
s, js = get("/admin/finance/commissions/order/not-a-uuid", FIN)
check("détail vente id invalide -> 400", s == 400, f"HTTP {s}")

for o in orders:
    s, js = get("/admin/finance/payments", FIN, order_number=o["number"])
    items = D(js)["items"]
    ok = len(items) == 1 and items[0]["payment_status"] in ("PAID", "VERIFIED") and not items[0]["anomaly_flag"] \
        and items[0]["provider"] == PROVIDER and items[0]["confirmation_actor"] == "PROVIDER"
    if items:
        it0 = items[0]
        check(f"paiements: {o['number']} montant = produits - points + livraison + majoration",
              near(float(it0["subtotal_amount"]) - float(it0["points_discount_amount"]) + float(it0["delivery_fee"]) + float(it0.get("payment_markup", 0)), it0["total_amount"])
              and near(it0["total_amount"], o["pay"]["final_total"]),
              f"{it0['subtotal_amount']} + {it0['delivery_fee']} + {it0.get('payment_markup')} = {it0['total_amount']}")
    check(f"paiements: {o['number']} réglé par le PSP, sans anomalie", ok,
          items[0].get("anomaly_reason", "") if items else "introuvable")
    if items:
        s, js = get(f"/admin/finance/payments/{items[0]['payment_id']}", FIN)
        check(f"détail paiement {o['number']}", s == 200 and near(D(js)["cash_due"], o["pay"]["cash_due"]), f"HTTP {s}")
s, js = get("/admin/finance/payments", FIN, order_number=cash["number"])
it = D(js)["items"]
check("paiement cash: statut DUE, pas d'anomalie", len(it) == 1 and it[0]["payment_status"] == "DUE" and not it[0]["anomaly_flag"])
s, js = get("/admin/finance/payments", FIN, payment_status="DUE", shop_id=SHOP, limit=100)
check("filtre paiements statut=DUE + boutique", s == 200 and all(i["payment_status"] == "DUE" and i["shop_id"] == SHOP for i in D(js)["items"]))
s, js = get("/admin/finance/payments", FIN, order_number=orders[0]["number"], date_from=TODAY, date_to=TODAY)
check("filtre paiements date_from=date_to=aujourd'hui inclut la commande du jour",
      s == 200 and len(D(js)["items"]) == 1, f"{len(D(js).get('items', []))} ligne(s)")
s, js = get("/admin/finance/payments", FIN, seller_id=SELLER_UID, limit=100)
other = [i for i in D(js)["items"] if i["business_id"] != BIZ]
check("filtre paiements par vendeur n'affiche que ses boutiques", s == 200 and not other,
      f"{len(other)} paiement(s) d'autres vendeurs sur {len(D(js)['items'])}")

# --------------------------------------------------------------------------
sec("FILTRES DU TABLEAU DE BORD")
def delta_check(label, **filters):
    b = snapshot(**filters) if False else None
for label, f, b in (("boutique", {"shop_id": SHOP}, before_shop), ("vendeur", {"seller_id": SELLER_UID}, before_seller)):
    a = snapshot(**f)
    check(f"filtre {label}: delta brut = ventes simulées",
          near(float(a["gross_sales"]) - float(b["gross_sales"]), exp_gross),
          f"{float(a['gross_sales']) - float(b['gross_sales']):.2f}")
a = snapshot(business_id=BIZ)
check("filtre business: brut ≤ global et identité tient", float(a["gross_sales"]) <= float(after_g["gross_sales"]) + TOL
      and near(float(a["gross_sales"]) - float(a["commission_amount"]), a["seller_net_amount"]))
a = snapshot(product_id=PROD)
check("filtre produit inclut les ventes simulées", float(a["gross_sales"]) >= exp_gross - TOL)
a = snapshot(variant_id=VARIANT)
check("filtre variante inclut les ventes simulées", float(a["gross_sales"]) >= exp_gross - TOL)
a = snapshot(commission_status="DUE")
check("filtre commission DUE: collectée = 0", near(a["collected_commission"], 0))
a = snapshot(commission_status="COLLECTED")
check("filtre commission COLLECTED: due = 0", near(a["due_commission"], 0))
a = snapshot(payment_status="PAID")
check("filtre paiement PAID: aucun dû", near(a["payments_due"], 0), f"dû={a['payments_due']}")
a = snapshot(date_from=TODAY, date_to=TODAY)
check("filtre dates = aujourd'hui inclut les ventes du jour", float(a["gross_sales"]) >= exp_gross - TOL, f"brut={a['gross_sales']}")
a = snapshot(date_to=YESTERDAY, shop_id=SHOP)
b = snapshot(date_from=TODAY, shop_id=SHOP)
check("hier + aujourd'hui = total boutique (pas de trou ni doublon)",
      near(float(a["gross_sales"]) + float(b["gross_sales"]), snapshot(shop_id=SHOP)["gross_sales"]))
s, js = get("/admin/finance/dashboard", FIN, seller_id="nope")
check("seller_id invalide -> erreur propre (pas 500)", s in (400, 422), f"HTTP {s}")

# vue vendeur == vue admin filtrée vendeur
_, sj = get("/seller/finances/dashboard", SELLER)
sv = D(sj)
av = snapshot(seller_id=SELLER_UID)
check("vue vendeur = vue Finance filtrée sur ce vendeur",
      near(sv["gross_sales"], av["gross_sales"]) and near(sv["commission_amount"], av["commission_amount"])
      and near(sv["payments_collected"], av["payments_collected"]),
      f"vendeur {sv['gross_sales']} / admin {av['gross_sales']}")

sec("RAPPORT /finance/summary (bandeau paiements)")
_, fs1 = get("/admin/finance/summary", FIN)
fs1 = D(fs1)
check("valeur commandes += 4 commandes", near(float(fs1["total_order_value"]) - float(fs0["total_order_value"]),
                                              sum(float(o["pay"]["final_total"]) for o in orders + [cash])),
      f"delta {float(fs1['total_order_value']) - float(fs0['total_order_value']):.2f}")
check("cash vérifié += paiements réglés", near(float(fs1["verified_cash"]) - float(fs0["verified_cash"]), exp_paid))
_, fsd = get("/admin/finance/summary", FIN, shop_id=SHOP, date_from=TODAY, date_to=TODAY)
fsd = D(fsd)
check("summary date_to=aujourd'hui inclut les commandes du jour", int(fsd["total_orders"]) >= 4,
      f"{fsd['total_orders']} commande(s) comptée(s)")

# --------------------------------------------------------------------------
sec("VENTILATIONS (boutique, produit, variante, vendeur, entreprise)")
for group in ("shop", "product", "variant", "seller", "business"):
    s, js = get("/admin/finance/breakdown", FIN, group=group)
    items = D(js)["items"]
    g = sum(float(i["gross_sales"]) for i in items)
    c = sum(float(i["commission_amount"]) for i in items)
    n = sum(float(i["seller_net_amount"]) for i in items)
    u = sum(int(i["units_sold"]) for i in items)
    check(f"{group}: lignes re-somment au global", abs(g - float(after_g["gross_sales"])) <= 0.05
          and abs(c - float(after_g["commission_amount"])) <= 0.05 and abs(n - float(after_g["seller_net_amount"])) <= 0.05
          and u == int(after_g["units_sold"]),
          f"brut {g:.2f}/{after_g['gross_sales']} comm {c:.2f}/{after_g['commission_amount']} unités {u}/{after_g['units_sold']}")
s, js = get("/admin/finance/breakdown", FIN, group="nope")
check("groupe invalide -> 400", s == 400, f"HTTP {s}")

sec("GRAPHIQUES (jour / semaine / mois)")
for iv in ("day", "week", "month"):
    s, js = get("/admin/finance/timeseries", FIN, interval=iv)
    pts = D(js)["points"]
    tot = sum(float(p["gross_sales"]) for p in pts)
    check(f"timeseries {iv}: somme des barres = brut global", near(tot, after_g["gross_sales"]), f"{tot:.2f}")
before_today = sum(float(p["gross_sales"]) for p in D(ts0)["points"] if p["period"] == TODAY)
_, js = get("/admin/finance/timeseries", FIN, interval="day")
after_today = sum(float(p["gross_sales"]) for p in D(js)["points"] if p["period"] == TODAY)
check("barre du jour += ventes simulées (temps réel)", near(after_today - before_today, exp_gross),
      f"{after_today - before_today:.2f}")
s, js = get("/admin/finance/timeseries", FIN, interval="year")
check("intervalle invalide -> 400 (pas un rapport silencieusement journalier)", s == 400, f"HTTP {s}")

sec("RÉSUMÉ COMMISSIONS (page Commissions)")
_, cs = get("/admin/finance/commissions/summary", FIN)
cs = D(cs)
check("KPI page Commissions = tableau de bord", near(cs["gross_sales"], after_g["gross_sales"])
      and near(cs["total_commission"], after_g["commission_amount"]) and near(cs["due_commission"], after_g["due_commission"]))
_, cs = get("/admin/finance/commissions/summary", FIN, status="DUE", shop_id=SHOP)
check("résumé filtré statut+boutique répond", "gross_sales" in D(cs))

# --------------------------------------------------------------------------
sec("ENCAISSEMENT DE LA COMMISSION")
cid = comm_ids[orders[0]["number"]]
comm0 = round(float(orders[0]["pay"]["products_final_total"]) * RATE0 / 100 + 1e-9, 2)
s, js = call("POST", f"/admin/finance/commissions/{cid}/collect", {"notes": "finance sim"}, COM)
check("commerce ne peut pas encaisser", s == 403, f"HTTP {s}")
s, js = call("POST", f"/admin/finance/commissions/{cid}/collect", {"notes": "finance sim"}, FIN)
check("finance encaisse la commission", s == 200, f"HTTP {s}")
s2, js2 = call("POST", f"/admin/finance/commissions/{cid}/collect", {"notes": "again"}, FIN)
check("double encaissement refusé", s2 == 400, f"HTTP {s2}")
col = snapshot()
check("commission encaissée +, due -", near(float(col["collected_commission"]) - float(after_g["collected_commission"]), comm0)
      and near(float(after_g["due_commission"]) - float(col["due_commission"]), comm0), f"{comm0}")
check("encaissée + due = commission totale", near(float(col["collected_commission"]) + float(col["due_commission"]), col["commission_amount"]))
_, js = get("/admin/finance/commissions", FIN, search=orders[0]["number"])
r = D(js)["commissions"][0]
check("ligne passe COLLECTED avec auteur et date", r["status"] == "COLLECTED" and r.get("collected_at") and r.get("collector_name"),
      f"{r['status']} par '{r.get('collector_name')}'")
s, js = call("POST", f"/admin/finance/commissions/{uuid.uuid4()}/collect", {}, FIN)
check("encaisser un id inexistant -> erreur", s in (400, 404), f"HTTP {s}")

# --------------------------------------------------------------------------
sec("TAUX DE COMMISSION")
s, js = call("PATCH", "/admin/finance/commission-config", {"rate": 5, "reason": f"finance sim {STAMP}"}, COM)
check("commerce ne peut pas changer le taux", s == 403, f"HTTP {s}")
s, js = call("PATCH", "/admin/finance/commission-config", {"rate": -1, "reason": "x"}, FIN)
check("taux -1 refusé en 400", s == 400, f"HTTP {s}")
s, js = call("PATCH", "/admin/finance/commission-config", {"rate": 101, "reason": "x"}, FIN)
check("taux 101 refusé en 400", s == 400, f"HTTP {s}")
s, js = call("PATCH", "/admin/finance/commission-config", {"rate": 0, "reason": f"finance sim {STAMP} zero"}, FIN)
check("taux 0 % accepté (promo sans commission)", s == 200 and near(D(js)["rate"], 0), f"HTTP {s} {str(js)[:120]}")
s, js = call("PATCH", "/admin/finance/commission-config", {"rate": 5, "reason": f"finance sim {STAMP}"}, FIN)
check("taux passé à 5 %", s == 200 and near(D(js)["rate"], 5), f"HTTP {s}")
o5 = make_order(1, "MOBILE_PAY_NOW", "r5")
settle(o5)
_, js = get("/admin/finance/commissions", FIN, search=o5["number"])
r5 = D(js)["commissions"][0]
check("nouvelle vente calculée à 5 %", near(r5["commission_rate"], 5)
      and near(r5["commission_amount"], round(float(o5["pay"]["products_final_total"]) * 0.05 + 1e-9, 2)),
      f"{r5['commission_rate']}% = {r5['commission_amount']}")
_, js = get("/admin/finance/commissions", FIN, search=orders[1]["number"])
check(f"ancienne vente reste figée à {RATE0} %", near(D(js)["commissions"][0]["commission_rate"], RATE0))
_, js = get("/admin/finance/dashboard", FIN)
check("tableau de bord affiche le taux courant", near(D(js)["commission_rate"], 5))
s, js = call("PATCH", "/admin/finance/commission-config", {"rate": RATE0, "reason": f"finance sim {STAMP} restore"}, FIN)
check(f"taux restauré à {RATE0} %", s == 200 and near(D(js)["rate"], RATE0))
hist = D(js)["history"]
check("historique des taux trace chaque changement avec auteur", any(f"finance sim {STAMP}" in (h.get("reason") or "") for h in hist)
      and all(h.get("admin_name") for h in hist[:3]))

# --------------------------------------------------------------------------
sec("ANNULATION D'UNE VENTE PAYÉE")
pre = snapshot()
s, js = call("POST", f"/buyer/orders/{orders[1]['id']}/cancel", {"reason": "finance sim cancel"}, BUYER)
print(f"  annulation acheteur d'une commande payée -> HTTP {s} {str(js)[:160]}")
post = snapshot()
_, js = get("/admin/finance/commissions", FIN, search=orders[1]["number"])
st = D(js)["commissions"][0]["status"]
_, pj = get("/admin/finance/payments", FIN, order_number=orders[1]["number"])
pst = D(pj)["items"][0]["payment_status"]
if s == 200:
    check("vente annulée: commission WAIVED et sortie du CA", st == "WAIVED"
          and near(float(pre["gross_sales"]) - float(post["gross_sales"]), orders[1]["pay"]["products_final_total"]),
          f"commission={st}")
    check("argent déjà payé: paiement marqué REFUNDED (sinon l'encaissement disparaît sans trace)",
          pst == "REFUNDED", f"paiement={pst}")
else:
    check("commande payée: annulation refusée côté acheteur (cohérent)", st in ("DUE", "COLLECTED"), f"HTTP {s}, commission={st}")

# --------------------------------------------------------------------------
sec("POINTS")
_, js = get("/admin/finance/points/users", FIN, search="buyer_rt_1789261221")
users = D(js)["items"]
check("recherche utilisateur points", len(users) == 1)
BUID = users[0]["user_id"]
bal0 = [a for a in users[0]["accounts"] if a["account_type"] == "BUYER"][0]["current_points"]
req_id = str(uuid.uuid4())
body = {"type": "ADD", "account_type": "BUYER", "request_id": req_id, "amount": 7, "reason": "finance sim credit"}
s, a1 = call("POST", f"/admin/finance/points/users/{BUID}/adjust", body, FIN)
s2, a2 = call("POST", f"/admin/finance/points/users/{BUID}/adjust", body, FIN)
check("crédit +7 appliqué", s == 200 and D(a1)["new_balance"] == bal0 + 7, f"{bal0} -> {D(a1).get('new_balance')}")
check("rejeu du même request_id = pas de double crédit", s2 == 200 and D(a2)["new_balance"] == bal0 + 7)
s, js = call("POST", f"/admin/finance/points/users/{BUID}/adjust",
             {"type": "REMOVE", "account_type": "BUYER", "request_id": str(uuid.uuid4()), "amount": 10 ** 9, "reason": "finance sim too much"}, FIN)
check("retrait > solde -> 409", s == 409, f"HTTP {s}")
s, js = call("POST", f"/admin/finance/points/users/{BUID}/adjust",
             {"type": "REMOVE", "account_type": "BUYER", "request_id": str(uuid.uuid4()), "amount": 7, "reason": "finance sim revert"}, FIN)
check("retrait -7 : solde restauré", s == 200 and D(js)["new_balance"] == bal0)
s, js = call("POST", f"/admin/finance/points/users/{BUID}/adjust",
             {"type": "ADD", "account_type": "BUYER", "request_id": str(uuid.uuid4()), "amount": 1, "reason": "abc"}, FIN)
check("justification < 5 caractères refusée", s == 400, f"HTTP {s}")
s, js = call("POST", f"/admin/finance/points/users/{BUID}/adjust",
             {"type": "ADD", "account_type": "SELLER", "request_id": str(uuid.uuid4()), "amount": 1, "reason": "finance sim seller"}, FIN)
check("points vendeur sans business_id refusés", s == 400, f"HTTP {s}")
s, js = call("POST", f"/admin/finance/points/users/{BUID}/adjust",
             {"type": "ADD", "account_type": "BUYER", "request_id": str(uuid.uuid4()), "amount": 1, "reason": "finance sim"}, COM)
check("commerce ne peut pas ajuster des points", s == 403, f"HTTP {s}")
s, js = get("/admin/finance/points/buyers", FIN, search="buyer_rt_1789261221")
check("liste points acheteurs", s == 200 and D(js)["total"] >= 1)
s, js = get(f"/admin/finance/points/buyers/{BUID}/history", FIN)
hist = D(js)["history"]
check("historique points montre les 2 ajustements admin", s == 200 and sum(1 for h in hist if h["reason"] == "ADMIN_ADJUSTMENT") >= 2)

sec("CROISSANCE VENDEURS")
s, js = get("/admin/finance/growth/sellers", FIN, search="seller_rt_1789261221")
items = D(js)["items"]
check("croissance: vendeur trouvé", s == 200 and len(items) >= 1)
s, js = get("/admin/finance/growth/sellers", FIN, limit=0)
check("croissance limit=0 ne casse pas", s == 200, f"HTTP {s}")

# --------------------------------------------------------------------------
sec("AVIS (produits / boutiques)")
for kind in ("products", "shops"):
    s, js = get(f"/admin/finance/reviews/{kind}", FIN)
    items = D(js)["items"]
    check(f"liste avis {kind}", s == 200, f"{len(items)} avis")
    if items:
        rv = items[0]
        orig = rv["moderation_status"]
        s, _ = call("POST", f"/admin/finance/reviews/{kind}/{rv['review_id']}/hide", {"reason": "x"}, FIN)
        check(f"masquer avis {kind} sans motif -> 400", s == 400, f"HTTP {s}")
        s, _ = call("POST", f"/admin/finance/reviews/{kind}/{rv['review_id']}/hide", {"reason": "finance sim hide"}, FIN)
        _, js = get(f"/admin/finance/reviews/{kind}", FIN, status="HIDDEN")
        check(f"masquer avis {kind}", s == 200 and any(i["review_id"] == rv["review_id"] for i in D(js)["items"]))
        s, _ = call("POST", f"/admin/finance/reviews/{kind}/{rv['review_id']}/restore", {"reason": "finance sim restore"}, FIN)
        check(f"restaurer avis {kind}", s == 200)
        if orig not in ("VISIBLE", ""):
            print(f"  NOTE: statut d'origine {orig} (restauré en VISIBLE)")
    s, _ = call("POST", f"/admin/finance/reviews/{kind}/{uuid.uuid4()}/hide", {"reason": "finance sim hide"}, FIN)
    check(f"masquer avis {kind} inexistant -> erreur", s in (400, 404), f"HTTP {s}")

# --------------------------------------------------------------------------
sec("DOSSIERS / LITIGES")
s, js = call("POST", "/admin/finance/cases", {"case_type": "PAYMENT_DISPUTE", "priority": "HIGH", "order_id": orders[2]["id"],
                                              "business_id": BIZ, "shop_id": SHOP, "title": f"Finance sim {STAMP}",
                                              "description": "Litige simulé"}, FIN)
check("création dossier", s == 201, f"HTTP {s} {str(js)[:120]}")
case = D(js)
CASE = case.get("id")
check("dossier rattaché à la commande", case.get("order_number") == orders[2]["number"])
s, js = get("/admin/finance/cases", FIN, status="OPEN")
check("filtre statut OPEN contient le dossier", any(c["id"] == CASE for c in D(js)["items"]))
s, js = get("/admin/finance/cases", FIN, order_id=orders[2]["id"])
check("filtre par commande ne renvoie que ses dossiers", s == 200 and all(c.get("order_id") == orders[2]["id"] for c in D(js)["items"]),
      f"{len(D(js)['items'])} dossier(s) renvoyé(s)")
s, js = call("POST", f"/admin/finance/cases/{CASE}/messages", {"visibility": "INTERNAL_ADMIN_NOTE", "message": "note sim"}, FIN)
check("ajout note interne", s == 201)
s, js = call("POST", f"/admin/finance/cases/{CASE}/assign", {"admin_id": FIN_ID}, FIN)
check("assignation", s == 200, f"HTTP {s}")
s, js = get(f"/admin/finance/cases/{CASE}", FIN)
d = D(js)
check("détail: UNDER_REVIEW, assigné, 1 message", d["status"] == "UNDER_REVIEW" and d.get("assigned_admin") and len(d["messages"]) == 1)
s, js = call("POST", f"/admin/finance/cases/{CASE}/resolve", {"status": "BOGUS", "resolution": "résolu par la sim"}, FIN)
check("statut de résolution invalide refusé", s == 400, f"HTTP {s}")
s, js = call("POST", f"/admin/finance/cases/{CASE}/resolve", {"status": "RESOLVED", "resolution": "résolu par la sim"}, FIN)
check("résolution", s == 200, f"HTTP {s}")
s, js = get(f"/admin/finance/cases/{CASE}", FIN)
check("dossier RESOLVED avec date", D(js)["status"] == "RESOLVED" and D(js).get("resolved_at"))
s, js = call("POST", f"/admin/finance/cases/{uuid.uuid4()}/assign", {"admin_id": FIN_ID}, FIN)
check("assigner un dossier inexistant -> erreur", s in (400, 404), f"HTTP {s}")
s, js = call("POST", f"/admin/finance/cases/{uuid.uuid4()}/resolve", {"status": "RESOLVED", "resolution": "inexistant"}, FIN)
check("résoudre un dossier inexistant -> erreur", s in (400, 404), f"HTTP {s}")

sec("RISQUES")
s, js = get("/admin/finance/risk", FIN)
check("liste risques", s == 200, f"{D(js).get('total')} évènement(s)")
s, js = call("POST", "/admin/finance/risk/scan", {}, FIN)
check("scan des règles de risque", s == 200, f"HTTP {s} {str(js)[:100]}")
s, js = call("POST", f"/admin/finance/risk/{uuid.uuid4()}/resolve", {"status": "DISMISSED", "reason": "inexistant sim"}, FIN)
check("résoudre un risque inexistant -> erreur", s in (400, 404), f"HTTP {s}")
s, js = call("POST", f"/admin/finance/risk/{uuid.uuid4()}/resolve", {"status": "WHATEVER", "reason": "statut bidon"}, FIN)
check("statut de risque invalide refusé", s == 400, f"HTTP {s}")

sec("CONFIGURATION DES PAIEMENTS")
s, js = get("/admin/finance/payment-config", FIN)
cfgs = D(js)["items"]
check("3 moyens de paiement listés", s == 200 and len(cfgs) == 3)
bad = [c["label"] for c in cfgs if "Ã" in c["label"]]
check("libellés sans caractères corrompus", not bad, f"corrompus: {bad}")
s, js = call("PATCH", "/admin/finance/payment-config/CASH_ON_DELIVERY", {"label": "x", "enabled": True, "markup_type": "BOGUS", "markup_value": 1}, FIN)
check("type de majoration invalide refusé", s == 400, f"HTTP {s}")
s, js = call("PATCH", "/admin/finance/payment-config/NOPE", {"label": "x", "enabled": True, "markup_type": "NONE", "markup_value": 0}, FIN)
check("moyen de paiement inconnu refusé", s in (400, 404), f"HTTP {s}")
s, js = call("PATCH", "/admin/finance/payment-config/CASH_ON_DELIVERY", {"label": "x", "enabled": True, "markup_type": "NONE", "markup_value": 0}, COM)
check("commerce ne peut pas modifier les paiements", s == 403, f"HTTP {s}")

# --------------------------------------------------------------------------
print("\n================ BILAN ================")
fails = [r for r in results if not r[2]]
print(f"{len(results)} vérifications, {len(fails)} échec(s)")
for sct, name, ok, detail in fails:
    print(f"  FAIL [{sct}] {name} :: {detail}")
json.dump({"orders": [o["number"] for o in orders + [cash, o5]], "case": CASE, "results": results},
          open(os.path.join(os.path.dirname(__file__), f"finance_sim_{STAMP}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
