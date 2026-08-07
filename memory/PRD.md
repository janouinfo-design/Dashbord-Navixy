# LOGITAG Dashboard - PRD

## Navigation
Vue generale | Analyse flotte | Conducteurs | Vehicules | Couts | IoT | (Audit via ?admin=true)

## Architecture Backend (Analytics Engine v1.0.0)
- `navixy_client.py` / `cache_manager.py` / `analytics_engine.py` / `server.py`
- ZERO fake data. Tous endpoints: from_date + to_date uniformes.

## Vue Generale
- 6 KPI operationnels cliquables (Utilisation, Actifs, Distance, Moteur, Mouvement, Hors ligne)
- Drawers contextuels riches (duree humaine, gravite, barres contribution)
- Insights operationnels (cartes entieres cliquables, pas de lien separe)

## Analyse Flotte (Fusion Performance + Efficacite)
- **Performance SUPPRIME** (100% doublons)
- **Efficacite REMPLACE** par page fusionnee
- 5 indicateurs analytiques (ZERO doublon Vue gen.) : Vehicules utilises, Sans activite, Sous-utilises, Fortement utilises, Km moy/vehicule utilise
- Barre categories interactive (clic = filtre table)
- Graphique "Vehicules utilises par jour (%)" avec tooltip definition
- Table triable 8 colonnes + filtres + recherche
- Drawer vehicule: stats, comparaison flotte, calendrier activite, graphique distance
- Insights actionnables (pas de repetition KPIs)
- Definitions avec tooltips: jour actif >= 1km, categories centralisees

## Regles
- `ACTIVE_DAY_THRESHOLD_KM = 1.0`
- Categories: inactif(0%) | sous-utilise(<30%) | modere(30-59%) | bonne(60-84%) | forte(>=85%)
- Heures moteur = compteur cumulatif total

## Completed
- [x] Analytics Engine v1.0.0, Audit, Debug, Carburant UI, PDF
- [x] Refonte Vue Generale (drawers UX riches)
- [x] **Fusion Performance + Efficacite → Analyse Flotte**
- Tests: 100% toutes iterations

## Backlog
- [ ] Integration Baubit (P2)
- [ ] Responsive mobile/tablette (P2)
- [ ] Auto-refresh (P2)
- [ ] Reverse geocoding positions (P3)
