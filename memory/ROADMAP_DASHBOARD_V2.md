# DASHBOARD V2 — Refonte Vue générale (VALIDÉE par user, à implémenter)

## Décisions utilisateur (verbatim: 1a, 2b, 3a, 4a, 5a)
1. **Catégories (1a)**: fusion AFFICHAGE Modéré+Bonne → « Utilisation normale » (30-84%). Seuils/calculs backend INCHANGÉS. Harmoniser libellés partout: Dashboard + Analyse flotte + drawers. Nomenclature unique: Sans activité | Sous-utilisé | Utilisation normale | Forte utilisation.
2. **Alertes critiques (2b — définition corrigée par user)**:
   - CRITIQUE: assurance/contrôle DÉJÀ ÉCHU; hors ligne PROLONGÉ/anormal (réutiliser logique existante de durée, ex >48h depuis last_update); problème réellement bloquant.
   - À SURVEILLER: hors ligne récent; batterie EV <20% (JAMAIS critique); échéance proche (<30j); sous-utilisation; forte utilisation.
   - JAMAIS d'alerte EV en production sans donnée EV réelle et récente.
3. **Conso thermique (3a)**: afficher l'ESTIMÉE uniquement (taux configuré × km, mécanisme existant), libellé obligatoire « Consommation estimée » + couverture (ex « basé sur 36/52 véhicules configurés »). obd_consumption EXCLU (unité non confirmée).
4. **Documents manquants (4a)**: OMIS cette itération (règle configurable plus tard dans module Documents).
5. **KPI EV (5a)**: MASQUÉS en production sans données réelles (pas de cartes « indisponible »). Si des EV sont identifiés sans télémétrie: UNE seule mention discrète « Données batterie non disponibles sur les véhicules électriques suivis ». Démo (tenant demo-ev): tout affiché + bandeau démo existant.

## Layout cible (cahier des charges §28, maquette fournie)
- L1: 6 KPI: Véhicules actifs (n/total + % parc), Hors ligne, Sans activité, Utilisation flotte %, Distance totale, Alertes critiques — avec comparaison période précédente (↑/↓/stable) quand calculable; périodes équivalentes uniquement.
- L2: 50% barre segmentée Utilisation flotte (4 catégories, n + %) | 50% Activité quotidienne (barres actifs + courbe km; agrégation jour/semaine si période longue).
- L3: ~65% Énergie & consommation (répartition motorisation donut/compteurs, Conso estimée L/100 + couverture, [démo: kWh/100, SoC moyen+couverture, EV batterie faible], Couverture télémétrie énergie = véhicules avec fuel_level OU ev_soc dispo / total) | ~35% Priorités du jour (5-7 max, rouge=critique orange=surveiller) + Actions recommandées déterministes.
- L4: ~65% Maintenance & conformité (Échéances<30j, Assurances à renouveler, Contrôles à réaliser — depuis vehicle_admin, cliquables → drawers) | ~35% Véhicules à surveiller (5 max: nom, statut, alerte principale, clic → fiche).
- Éco-conduite: une ligne compacte (score moyen + n conducteurs à surveiller) si données; sinon petite mention, pas de grand bloc vide.
- SUPPRESSION redondances: retirer les anciennes cartes anomalies/tuiles dupliquées; progression synthèse (KPI) → priorité → véhicule. 1 info = 1 endroit.

## Contraintes techniques
- Réutiliser: /fleet/stats, /fleet/efficiency, /analytics/trends, /drivers, /vehicles/capabilities (cache 6h), /vehicles/admin. AUCUN endpoint géant nouveau.
- Comparaison période précédente: étendre /fleet/stats (param compare=true → bloc previous_period {total_mileage, active_count, utilization}) OU réutiliser mécanisme de comparaison existant dans OverviewTab (vérifier: des comparaisons existaient déjà historiquement).
- Drill-downs: réutiliser Drawer d'EnergySection (compte drawer == KPI, plaques, clic → fiche via onOpenVehicle/initialSelected). Conserver le contexte de période.
- data_status/partial: bannière existante conservée. Jamais 0 pour donnée absente.
- Design: fond clair, cartes blanches, orange LOGITRAK actions, rouge=problème réel, vert=positif, bleu=info. Responsive 1920/1366/1024.
- Aucune régression: Analyse flotte (seulement libellés harmonisés), Véhicules, Conducteurs, auth/tenant/RBAC intouchés.

## Fichiers à modifier
- frontend: OverviewTab.jsx (refonte), EnergySection.jsx (fusion/absorption dans nouveaux blocs), DashboardLayout.jsx (léger), AnalyseFlotteTab.jsx (libellés catégories uniquement), metrics.js si besoin libellés.
- backend: analytics_engine.py (previous_period optionnel dans fleet_stats/efficiency), rien d'autre.

## Tests obligatoires (fin: rapport Réalisé/Partiel/Non réalisé avec raisons)
Flottes: Techlift (100% thermique réel), FlexMobil (mixte réel, 18 fuel_level, 0 EV data), demo-ev (EV simulé), test-beta (Navixy KO → dégradation propre). Vérifier: pas de SoC=0, pas de 0 L/100 sur véhicule sans taux, couverture affichée, drill-downs = comptes exacts, périodes (aujourd'hui/7j/30j/custom), 1920/1366/1024, pytest 48/48, multi-tenant.

## Statut: CHANTIER CLÔTURÉ (2026-06 — iterations 24/25/26/27, frontend 100%, suites pytest de référence 120/120)
Rapport final Réalisé/Partiel/Non réalisé remis à l'utilisateur. Détails d'implémentation dans PRD.md.

## Backlog priorisé VALIDÉ PAR L'UTILISATEUR (chantiers SÉPARÉS — ne pas mélanger avec le Dashboard):
1. **Conducteurs & Éco-conduite** — prochain chantier, AUDIT COMPLET SANS CODE obligatoire avant toute modification
2. **Configuration consommation estimée** — valeur PAR VÉHICULE avec fallback éventuel au niveau client (pas uniquement un taux global client)
3. **Aperçu Documents** — à intégrer dans un futur chantier Documents
4. **Historique Snapshots (deltas SoC/couverture)** — REPORTÉ : à mettre en place seulement quand besoin réel de tendances + données EV réelles en production
