# Roadmap — Amélioration Réception / Caisse / Emballages

## Photos produits et quantités en gros
- [x] Neuf photos disponibles dans la fiche produit ; photos associées aux trois produits existants et remplaçables.
- [x] Saisie et correction directe de la quantité en gros sans retirer la ligne pendant la saisie.
- [x] Galerie et import sauvegardés puis relus après rechargement en session réelle ; quantité 25 et total vérifiés, sept tests réussis.

## Cadeaux et vente en gros showroom
- [x] Fardeaux : nombre et unités par fardeau réglables par ligne ; 3 × 12 = 36 et total 36 000 DA vérifiés en session réelle, limite de stock et neuf tests validés.
- [x] Taille du fardeau fixée par produit (Unités par fardeau dans la fiche produit) ; en gros, le nombre de fardeaux seul suffit, quantité et total calculés automatiquement (1 × 12 = 12, 2 × 12 = 24 vérifiés).
- [x] Cadeau : sortie de stock sans recette ni dette, ticket 80 mm.
- [x] Vente en gros : client, prix par ligne, paiement total/partiel, bon A5 selon le modèle.
- [x] Deux opérations vérifiées en session réelle : stock, paiement 100 DA sur 800 DA, reste 700 DA, réimpression ; bon A5 corrigé et vérifié sur une page, données de test retirées.

## Corrections ticket / Vercel
- [x] Showroom adapté au rouleau 80 mm ; dimensions mesurées appliquées à la page par défaut et nommée, PDF court vérifié sur une page de 80 × 104 mm.
- [x] Ticket showroom compact vérifié : exemple de deux articles réduit de 115 à 90 mm, toutes les informations conservées.
- [x] Longueur du ticket adaptée, chargement du logo attendu ; sorties navigateur 58/80 mm vérifiées sur une page, jusqu’à 35 articles.
- [x] Logo accessible par une URL absolue partagée sur toutes les pages et les reçus PDF.
- [ ] Vérification sur l’imprimante physique et sur le site Vercel : attend le redéploiement et le test de l’utilisateur.

## Base de données (migration 0004 appliquée, types régénérés)
- [x] olive_receptions : client_choice, sold_kg, oil_kg, paid, remaining, payment_status, transform_status, cancelled
- [x] settings : prix du jour (daily_price)
- [x] Table cash_movements (ENTRÉE/SORTIE, source, motif, référence, utilisateur) + RLS + grants + dedupe
- [x] sales : sale_type (HUILE / EMBALLAGE)
- [x] Trigger : paiement vente → mouvement caisse (sans doublon)
- [x] Trigger : réception payée → sortie caisse « Achat olives »
- [x] Trigger : dépense → sortie caisse
- [x] Validation mixte : sold_kg + oil_kg = poids total (trigger serveur)
- [x] Module « caisse » dans les permissions (can_write, COMPTABLE)

## Réception
- [x] Formulaire : choix client, prix du jour prérempli, paiement (payé/partiel/non payé + reste auto)
- [x] Validation mixte côté client
- [x] Liste : colonnes choix/paiement/statut transformation + filtres
- [x] Fiche agriculteur rapide depuis la réception (FarmerSheet)
- [x] Annuler la réception (traçable) au lieu de supprimer si liée
- [ ] Bon A5 : ajouter choix client, montant payé, reste, statut (écran + PDF)
- [x] Boutons post-enregistrement : Imprimer A5 / PDF / Nouvelle réception / Voir

## Caisse
- [x] Page /caisse : solde, liste mouvements, ajout entrée/sortie avec source libre
- [x] Menu sidebar + permissions (ADMIN, COMPTABLE)
- [ ] Rapports : ventes emballages séparées

## Ventes emballages
- [ ] Type de vente HUILE/EMBALLAGE dans le formulaire vente (défaut HUILE posé, UI à faire)
- [ ] Mouvement stock + caisse si payé (triggers déjà en place, à vérifier)

## Paramètres
- [ ] Champ « Prix du jour » (DA/kg), action admin

## Journal
- [ ] Logs : changement choix client, mouvements caisse, vente emballage

## Vérifications migration
- [ ] Valider colonnes expenses (user_id/created_by) utilisées par le trigger caisse
- [ ] Valider created_by sur réceptions pour le trigger caisse
- [ ] Numéro CAI réattribué à chaque update de réception (delete/recreate) — à examiner

## Tests (spec §30)
- [ ] TEST 1-9 via navigateur + rapport final

## Application chauffeur / POS
- [x] Rôle CHAUFFEUR, véhicules, stock véhicule, chargement, livraisons (BL), vente directe (VCH), retours/pertes (RET), caisse chauffeur, clôture (TRN), validation remise → Caisse
- [x] Ticket 80 mm, page admin « Chauffeurs »
- [ ] Mode hors ligne (non prévu)

## Identité du logiciel
- [x] Logo fourni et nom Medjadja Olive : connexion, menu, en-tête mobile et espace chauffeur ; nom des documents et titres des pages harmonisés.

## Showroom (supérette)
- [x] Cash par défaut / TPE, ticket thermique selon le modèle fourni ; encaissements et réimpression vérifiés, ventes de test supprimées.
- [ ] Coordonnées sur le ticket : adresse, téléphone, wilaya et NIF attendent les valeurs de l’utilisateur (paramètres actuellement vides).
- [x] Rôle VENDEUR, page /showroom : scan code-barres, panier, encaissement, rendu monnaie, ticket 80 mm
- [x] Vente → stock principal + Ventes + Caisse (RPC showroom_sell)
- [x] Boutons « Produit » (ajout) et « Modifier » (recherche puis fiche modifiable) + crayon sur chaque produit

## Découplage backend (fait)
- [x] Couche REST `src/lib/api.ts` (login, CRUD /tables, /rpc, /users) + VITE_API_URL
- [x] AppContext, fleet, locks, users, permissions, caisse, flotte, showroom, paramètres, login branchés sur l'API REST
- [ ] À faire côté utilisateur : implémenter les endpoints décrits en tête de src/lib/api.ts
