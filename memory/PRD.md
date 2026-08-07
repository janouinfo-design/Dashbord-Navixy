# LOGITAG Dashboard - PRD

## Architecture
- **Dashboard** avec 8 onglets (7 standard + 1 Audit admin)

## Backend (Analytics Engine v1.0.0)
- `navixy_client.py` / `cache_manager.py` / `analytics_engine.py` / `server.py`
- ZERO fake data. Tous endpoints: from_date + to_date uniformes.

## Vue Generale (Refonte)
- 6 KPI cliquables avec drawers (Utilisation, Actifs, Distance, Moteur, Mouvement, Hors ligne)
- Insights operationnels cliquables
- DashboardDetailDrawer generique

## Efficacite (Refonte Complete)
### KPIs
- Utilisation moyenne (%), Distance totale (km), Vehicules utilises (N/total), Heures moteur (h), Ralenti (instantane), Sans activite (N)
### Sections
- Resume efficacite avec barre de distribution categories
- Graphique utilisation flotte (% vehicules actifs/jour)
- Graphique distance quotidienne
- Tableau vehicules triable/filtrable (8 colonnes)
- Drawer vehicule avec: stats, badge categorie, comparaison flotte, calendrier activite jour/jour, graphique distance
- Insights: inactif, sous-utilise, fortement utilise
### Regles
- `ACTIVE_DAY_THRESHOLD_KM = 1.0` (seuil jour actif, centralise backend)
- Categories: inactif(0%), sous_utilise(<30%), modere(30-60%), bonne(60-85%), tres_utilise(>=85%)
- Heures moteur = compteur cumulatif total (pas periodique)
- Ralenti = instantane snapshot uniquement

## Coherence KPI
Tous les endpoints utilisent les memes from_date/to_date. Drift cold-cache ~3km documente (recommendation: partager mileage cache entre endpoints).

## Completed
- [x] Analytics Engine v1.0.0, Page Audit, Mode Debug, Config Carburant UI, Export PDF
- [x] Refonte Vue Generale (6 KPI drawers, insights, coherence dates)
- [x] **Refonte Efficacite** (6 KPIs, resume, graphiques, tableau triable/filtrable, drawer vehicule avec calendrier activite + comparaison flotte, insights, categories centralisees)
- Tests: Backend 20+/20+, Frontend 100%

## Backlog
- [ ] Integration Baubit (P2)
- [ ] Responsive mobile (P2)
- [ ] Auto-refresh temps reel (P2)
- [ ] Partage mileage cache entre endpoints (P3)
