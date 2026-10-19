import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { bundleQuantity, orderAmounts, parseOrderQuantity } from "./showroom-order";

describe("Showroom", () => {
  test("fardeaux : quantité totale égale nombre multiplié par unités", () => {
    assert.equal(bundleQuantity("3", "12"), 36);
    assert.equal(bundleQuantity("3", "6"), 18);
    assert.equal(orderAmounts("GROS", [{ qty: bundleQuantity("3", "12"), price: 1000 }], "").total, 36000);
  });
  test("fardeaux : saisie vide conservée sans quantité et valeurs invalides refusées", () => {
    assert.equal(bundleQuantity("", "12"), 0);
    assert.ok(Number.isNaN(bundleQuantity("-1", "12")));
    assert.ok(Number.isNaN(bundleQuantity("2", "1.5")));
  });
  test("la quantité de gros modifiée recalcule le total et le reste", () => {
    const qty = parseOrderQuantity("25");
    const a = orderAmounts("GROS", [{ qty, price: 1200 }], "20000");
    assert.deepEqual([qty, a.total, a.remaining], [25, 30000, 10000]);
  });
  test("la saisie peut être vidée et accepter une quantité décimale", () => {
    assert.equal(parseOrderQuantity(""), 0);
    assert.equal(parseOrderQuantity("2,5"), 2.5);
  });
  test("un cadeau ne génère ni recette ni dette", () => {
    assert.deepEqual(orderAmounts("CADEAU", [{ qty: 2, price: 1200 }], ""), { total: 0, paid: 0, remaining: 0, received: 0, change: 0 });
  });
  test("vente en gros partiellement payée", () => {
    const a = orderAmounts("GROS", [{ qty: 50, price: 1200 }], "20000");
    assert.deepEqual([a.total, a.paid, a.remaining], [60000, 20000, 40000]);
  });
  test("vente en gros totalement payée", () => {
    const a = orderAmounts("GROS", [{ qty: 50, price: 1200 }], "");
    assert.deepEqual([a.paid, a.remaining], [60000, 0]);
  });
  test("vente en gros non payée", () => {
    const a = orderAmounts("GROS", [{ qty: 50, price: 1200 }], "0");
    assert.deepEqual([a.paid, a.remaining], [0, 60000]);
  });
  test("refuse un paiement supérieur au total", () => {
    assert.throws(() => orderAmounts("GROS", [{ qty: 1, price: 500 }], "501"));
  });
});
import { checkRepayment, customerDebt, parseTiers, wholesaleUnitPrice } from "./showroom-order";
describe("Tarifs de gros et crédit", () => {
  const item = { salePrice: 1000, wholesalePrice: 900, wholesaleTiers: [{ min: 120, price: 850 }, { min: 240, price: 800 }] };
  test("prix de gros de base sous le premier palier", () => assert.equal(wholesaleUnitPrice(item, 36), 900));
  test("palier atteint", () => { assert.equal(wholesaleUnitPrice(item, 120), 850); assert.equal(wholesaleUnitPrice(item, 300), 800); });
  test("sans prix de gros on reprend le détail", () => assert.equal(wholesaleUnitPrice({ salePrice: 1000 }, 10), 1000));
  test("3 cartons de 12 = 36 unités sorties", () => assert.equal(bundleQuantity("3", "12"), 36));
  test("lecture des paliers", () => { assert.deepEqual(parseTiers("240:800, 120:850"), [{ min: 120, price: 850 }, { min: 240, price: 800 }]); assert.equal(parseTiers("abc"), null); });
  test("dette 100 000 - versement 40 000 = 60 000", () => {
    const sales = [{ customerId: "c", remaining: 70000 }, { customerId: "c", remaining: 30000 }, { customerId: "x", remaining: 5 }];
    const debt = customerDebt(sales, "c");
    assert.equal(debt, 100000); assert.equal(checkRepayment(debt, 40000), null); assert.equal(debt - 40000, 60000);
  });
  test("versement supérieur à la dette refusé", () => assert.ok(checkRepayment(60000, 60001)));
  test("vente à crédit : rien versé, tout reste", () => assert.deepEqual(orderAmounts("GROS", [{ qty: 36, price: 900 }], "0").remaining, 32400));
});
