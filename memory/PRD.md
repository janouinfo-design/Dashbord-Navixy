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
- **REMPLACEE par la refonte v2 ci-dessous (iter 11)**

## Vue Generale — REFONTE v2 (iter 11, maquette modulaire sans heatmap)
- Rangee 1 (6 KPI): resume flotte (active/sans activite % + sparkline + alerte hors ligne),
  4 cartes categories avec donut SVG (clic → Analyse flotte), Km moy/utilise + mini barres
- Rangee 2: Repartition (barre empilee + legende), Statut & impact financier (donut + carburant L/CHF
  si taux configure sinon "indisponible + lien Couts"), Activite quotidienne (barres empilees par
  categorie + ligne total km/jour, jours FR)
- Rangee 3: Anomalies & alertes (regles deterministes cliquables), Conducteurs & score eco
  (top 5 notations natives Navixy plugin 46, fetch lazy), Actions recommandees + Vehicule snapshot (top 5 km)
- Header: "X en ligne" (connexion instantanee) ≠ "Flotte active" (utilisation periode)
- Comparaison periode precedente (iter 11b): badges Delta reels sur les 6 KPI
  (flotte active, 4 categories, km moy/utilise + km total) via /fleet/efficiency sur la
  periode precedente de meme duree; tooltip = valeur precedente + dates; couleur bonne/mauvaise
  seulement quand univoque (active up=vert, sous-utilise up=rouge), sinon neutre; footer mentionne les dates
- AUCUNE metrique inventee (pas de TCO/satisfaction/usure) — couts uniquement via config carburant CHF
- Anciens drawers Vue generale remplaces par navigation croisee vers les onglets detailles
- Tests: iteration_11.json — 100% frontend + regression tous onglets

## Analyse Flotte — REFONTE v2 "Analyse d'utilisation" (iter 12)
- En-tete: titre + sous-titre arbitrage + filtre GROUPES NAVIXY reels (/api/groups nouveau, group_id
  ajoute aux vehicules efficiency) — tout le contenu se recalcule sur le scope groupe (reset auto si groupe absent)
- Zone 1 (6 KPI): Flotte active vs dormante (% + badge immobiles), 4 categories (compte+%+seuil, disabled a 0),
  Intensite km moy./actif + volume total
- Zone 2: Structure d'utilisation (barre empilee + legende interactive = filtre table),
  Activite du parc (barres actifs/jour, couleur=intensite, ligne moyenne pointillee, clic=filtre jour)
  — chart calcule cote client depuis daily_breakdown du scope
- Zone 3: Recommandations deterministes (Equilibrage/Reduction/Concentration/Charge/Donnees,
  AUCUN montant ou % invente) + rappel Score eco moyen du parc (moyenne notations Navixy plugin 46,
  fetch lazy) + Synthese carburant (km/L/CHF depuis config uniquement, pas de pertes ralenti)
- CONSERVE (iter 9): 5 categories aux seuils valides, table triable + 7 filtres + recherche,
  drawer vehicule (calendrier, vs flotte), banniere filtre jour, footer seuils
- Tests: iteration_12.json — 100% backend (7/7) + 100% frontend

## Analyse Flotte (Fusion Performance + Efficacite) — v1 (iter 9, remplacee par v2 ci-dessus)
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

## Conducteurs / Eco-conduite — FINALISE (2026 iter 10)
- Score eco = notation NATIVE Navixy plugin 46 "Qualite de conduite" (0-100 + etoiles), affichee telle quelle
- AUCUNE categorisation/conversion LOGITRAK (pas de seuils 80/60/40) — couleur derivee des etoiles Navixy
- Backend: /api/drivers/ecodriving (ecodriving.py) — generate/status/retrieve/delete rapport plugin 46 + track/list
- Attribution STRICTE: donnees conducteur uniquement via employee.tracker_id Navixy
- Vehicules avec activite SANS conducteur assigne (AUDI, 5-Alliance, camion NEDIR): evenements NON attribues, section dediee
- Statuts distincts: "Aucun vehicule assigne" / "Aucune donnee sur la periode" / "Donnees disponibles"
- KPI: Avec vehicule X/Y, Score eco moyen, Penalites /100km, Distance attribuee, Trajets, Temps de conduite
- Table triable (nom/score/distance/penalites100km) + filtres Tous|Avec vehicule|Sans vehicule|Avec activite + recherche
- Drawer: score natif + "Pourquoi ce score ?" (freinages/accel/virages/ralenti/exces vitesse en /100km + brut),
  penalites par jour (stacked chart couleurs Navixy), evenements recents geolocalises avec lien Google Maps
- Radar artificiel SUPPRIME; footer "Source de verite" (donnee → endpoint → methode → attribution)
- Periode = selecteur global du dashboard (from/to identiques partout)
- Indicateurs /100km = count ÷ km × 100 (idling en min/100km)
- Cache tenant 300s (1ere generation 5-45s)
- Tests: iteration_10.json — 100% backend (9/9) + 100% frontend

## White-label (iter 12b)
- "Navixy" remplace par "LOGITRAK" dans TOUS les textes visibles (frontend, sources API, PDF, titre API)
- Identifiants techniques conserves: navixy_client.py, NavixyClient, NAVIXY_API_URL/NAVIXY_HASH, cles JSON navixy_*
- Regle pour la suite: ne plus ecrire "Navixy" dans les nouveaux textes UI — utiliser "LOGITRAK"

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
- [x] **Refonte Conducteurs / Eco-conduite** (iter 10): score natif Navixy plugin 46, attribution stricte, drawer explicatif, 100% teste

## Backlog
- [ ] Integration Baubit (P2)
- [ ] Responsive mobile/tablette complet (P2)
- [ ] Auto-refresh (P2)
- [ ] Reverse geocoding positions (P3)
