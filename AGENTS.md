<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Product photos use the shared showroom photo picker: provided photos are CDN pointers and replacement uploads use private Cloud storage paths resolved to signed URLs through api.ts. Why: persistent editable photos without exposing private storage or depending on the deployment host.

- Olive reception fast workflow (search/quick-add farmer, receipt) lives in `src/components/reception/` — keep it out of other modules. Why: reception speed is the core operator workflow.
- A5 receipt printing uses a body-level portal (`.receipt-print-root`) plus named `@page receipt-a5` in `src/styles.css` and the `print-receipt` body class. Why: prints only the receipt without touching the app layout; other printouts (lists) keep the default page size.
- ID card OCR (tesseract.js) is loaded by dynamic `import()` in the browser only, always wrapped in try/catch with a manual-entry fallback. Why: heavy CPU/assets, must never enter SSR/server paths or block the manual workflow.
- Document numbers (REC/VTE/PROD/DEP/MVT) are assigned server-side by trigger; clients insert with an empty number and re-read the saved row. Why: atomic, no collisions between concurrent operators.
- Per-user module access (none/read/write) lives in `user_permissions`; absent rows fall back to the role default, and `can_write()` applies the same rule server-side. Why: role is only a starting template the admin can override.
- Critical tables (sales, payments, cash_movements) use `record_locks` via `acquire_lock/release_lock` RPCs plus the `guard_critical` trigger (edit lock + creator cannot delete own row unless ADMIN). Why: mutual exclusion and separation of duties enforced server-side.
- Driver/POS app (`/chauffeur`, role CHAUFFEUR) and its admin page (`/flotte`) write vehicle stock, deliveries, driver sales, returns and route closing only through SECURITY DEFINER RPCs (`fleet_load`, `create_delivery`, `complete_delivery`, `driver_sell`, `driver_return`, `close_route`, `validate_route`); driver tables are SELECT-only for clients. Why: same database as the main app, stock never negative, permissions enforced server-side.
- Driver tickets print on 80 mm thermal paper via `.ticket-print-root` portal + `@page ticket-80` + `print-ticket` body class. Why: same isolation pattern as the A5 receipt.
- Showroom POS uses `showroom_sell` for retail and idempotent `showroom_document` for gifts/wholesale; gifts create stock-out movements only, wholesale reuses sales/payment triggers, and immutable snapshots in `showroom_documents` support reprints. Why: atomic stock/accounting effects without gift revenue or duplicate submissions.
- Wholesale receipts live in `src/components/showroom/`, with an isolated body portal and named A5 page; thermal gifts reuse the shared ticket. Why: independent paper formats preserve existing reception and driver printing.
- Showroom receipts use a showroom variant of the shared thermal ticket with received/change amounts in its print snapshot; driver tickets keep their existing fields. Why: distinct receipt layouts without duplicating print infrastructure.
- Thermal printing uses `src/lib/ticket-print.ts` to wait for images and fonts and set matching measured default and named-page dimensions; showroom uses the shared ticket portal. Why: roll receipts must not fall back to office-paper sizes when named pages are ignored.
- All logo references use `src/lib/brand.ts` with an absolute URL to the existing asset host. Why: external hosting such as Vercel does not serve Lovable's relative asset endpoint.
- Toutes les données passent par `src/lib/api.ts`, une couche générique branchée sur le client Supabase de Lovable Cloud (RLS appliquée). Why: un seul point d'accès aux données, branches futures faciles.
- La connexion s'authentifie par email + mot de passe via Lovable Cloud (`supabase.auth`), session persistée par le client ; la gestion des comptes (création/modif/suppression) passe par les fonctions serveur de `src/lib/users.functions.ts` réservées ADMIN. Why: comptes gérés par le Cloud, l'admin contrôle qui accède.
