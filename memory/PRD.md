# LOGITRAK Dashboard - PRD

## Navigation
Vue generale | Analyse flotte | Conducteurs | Vehicules | Couts | IoT | (Audit via ?admin=true)

## Architecture Backend (Analytics Engine v1.0.0)
- `navixy_client.py` / `cache_manager.py` / `analytics_engine.py` / `server.py`
- ZERO fake data. Tous endpoints: from_date + to_date uniformes.

## Vue Generale
- 6 KPI operationnels cliquables (Utilisation, Actifs, Distance, Moteur, Mouvement, Hors ligne)
- Drawers contextuels riches (duree humaine, gravite, barres contribution)
- Insights operationnels (cartes entieres cliquables, pas de lien separe)

## Analyse Flotte (Fusion Performance + Efficacite) — FINALISE
- **Performance SUPPRIME** (100% doublons)
- **Efficacite REMPLACE** par page fusionnee
- Hierarchie: Total → Utilises / Sans activite → 4 sous-categories
- 4 categories utilisees (source unique CATEGORIES):
  - Sous-utilise: <30% (rouge)
  - Modere: 30-59% (ambre)
  - Bonne utilisation: 60-84% (emeraude)
  - Forte utilisation: >=85% (bleu)
- Sans activite: 0% (gris) — label unifie partout (KPI, barre, legende, filtres, badges)
- KPI: Vehicules utilises, Sans activite, 4 categories, Km moy/vehicule utilise (tooltip formule)
- Barre categories interactive (clic = filtre table) + legende
- Graphique barres quotidiennes compact (260px):
  - Jours en francais (Sam, Dim, Lun...)
  - Tooltip date complete + vehicules actifs/total + % + km
  - Ligne moyenne periode
  - Clic barre = filtre table vehicules actifs ce jour
  - Banniere filtre jour: "Filtre actif : Lundi 2 fevrier — X vehicules" + Reinitialiser
- Table triable 8 colonnes + filtres complets (tous visibles, 0-count desactives) + recherche
- Moteur (total): compteur cumulatif, tooltip header, "h" suffixe, "—" si indisponible
- Drawer vehicule: stats, comparaison flotte, calendrier activite, graphique distance
- "A retenir": 3-4 insights deterministes, cliquables, en francais
- Filtre unique: KPI/barre/legende/filtres/jour = meme etat synchronise
- Definitions avec tooltips (Tip component: span role=button, pas button imbrique)
- Footer: seuils documentes + source Navixy

## Regles
- `ACTIVE_DAY_THRESHOLD_KM = 1.0`
- Categories: sans_activite(0%) | sous-utilise(<30%) | modere(30-59%) | bonne(60-84%) | forte(>=85%)
- Heures moteur = compteur cumulatif total
- Invariants verifies: used+inactive=total, sum(cats)=total, KPI=filtres

## Completed
- [x] Analytics Engine v1.0.0, Audit, Debug, Carburant UI, PDF
- [x] Refonte Vue Generale (drawers UX riches)
- [x] Fusion Performance + Efficacite → Analyse Flotte
- [x] **Finalisation Analyse Flotte** (2026-02-07):
  - Labels coherents "Sans activite" partout (remplace "Inactif")
  - Jours francais dans graphique et insights
  - Filtres table complets (7 boutons, 0-count visible desactive)
  - Moteur (total) avec suffixe "h", tooltip header cumulatif, "—" pour indisponible
  - Tip component: span role=button (HTML valide, pas button imbrique)
  - Banniere filtre jour: date complete francaise
  - Tri par nom en asc par defaut
  - Tests: 100% backend (invariants 1/7/31 jours) + 100% frontend (iteration_9)
  - Regression: tous onglets fonctionnels, pas de tabs fantomes

## Backlog
- [ ] Integration Baubit (P2)
- [ ] Responsive mobile/tablette complet (P2)
- [ ] Auto-refresh (P2)
- [ ] Reverse geocoding positions (P3)
