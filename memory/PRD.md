# LOGITAG Dashboard - PRD

## Architecture
- **Un seul Dashboard** avec 7 onglets horizontaux (pas de sidebar)
- **Onglets** : Vue générale | Performance | Efficacité | Conducteurs | Véhicules | Coûts | IoT

## Backend Architecture (Analytics Engine v1.0.0)
```
/app/backend/
├── server.py              # Routes API (slim)
├── navixy_client.py       # Client API Navixy centralisé, audit des requêtes
├── analytics_engine.py    # Moteur KPI strict, traçabilité complète
├── cache_manager.py       # Cache isolé par tenant
└── requirements.txt
```

### Règles strictes
1. **ZERO données aléatoires** — tout provient de Navixy
2. **Audit trail** (`_audit`) sur chaque réponse API
3. Si donnée indisponible → `null` (frontend: "N/A")
4. Prix carburant configurable par tenant (défaut: 2.00 CHF/L)
5. Cache isolé par tenant (TTL 5 min)

### Sources de données Navixy
- `tracker/list` → liste des véhicules
- `tracker/get_state` → état instantané (mouvement, vitesse, GPS)
- `tracker/stats/mileage/read` → kilométrage journalier (RÉEL)
- `tracker/counter/value/list[odometer]` → odomètre total
- `tracker/counter/value/list[engine_hours]` → heures moteur
- `tracker/group/list` → groupes de trackers
- `employee/list` → liste des conducteurs

### Données NON disponibles (marquées null)
- Historique temps conduite/ralenti/arrêt
- Consommation carburant réelle (sans capteur)
- Infractions de vitesse
- Score d'efficacité historique

## Frontend Structure
```
App.js → DashboardLayout.jsx
  Header + Tabs
  tabs/
    OverviewTab.jsx     (KPIs réels, Insights, Engins ralenti, Charts distance)
    PerformanceTab.jsx  (Utilisation, Radar, Top 10 distance)
    EfficiencyTab.jsx   (Utilisation % par véhicule, jours actifs)
    DriversTab.jsx      (Score utilisation, Classement, Détail drawer)
    VehiclesTab.jsx     (KPIs cliquables, Table, Détail expandable)
    CostsTab.jsx        (Carburant configurable, prompt si non configuré)
    IoTTab.jsx          (Flow editor)
  shared/
    UIComponents.jsx
    PeriodSelector.jsx
  lib/
    api.js
    metrics.js          (v2 — basé sur utilization_score, null-safe)
```

## Multi-Client
- dashboard.logitrak.ch (12 véhicules)
- guimet.logitrak.ch (4 véhicules)
- membrez.logitrak.ch (202 véhicules)
- Script add-client.sh pour ajout automatisé

## API Endpoints Clés
| Endpoint | Données | Source |
|---|---|---|
| GET /api/fleet/stats | Kilométrage, odomètre, heures moteur, état GPS | Navixy direct |
| GET /api/fleet/efficiency | Utilisation %, jours actifs, état mouvement | Navixy direct |
| GET /api/analytics/trends | Distance quotidienne, véhicules actifs | Navixy direct |
| GET /api/analytics/vehicle-comparison | Utilisation 7j, distance totale | Navixy direct |
| GET /api/fleet/idle-by-group | Ralenti par groupe d'engins | Navixy direct |
| GET /api/reports/driver | Conducteurs et véhicules assignés | Navixy direct |
| GET /api/config/fuel | Configuration carburant par tenant | MongoDB |
| PUT /api/config/fuel | Modifier prix/taux carburant | MongoDB |
| DELETE /api/config/fuel | Reset config carburant | MongoDB |

## Completed
- [x] Architecture SaaS avec onglets horizontaux (7 onglets)
- [x] Backend optimisé (parallel + cache tenant-isolé)
- [x] Multi-client (3 clients actifs + add-client.sh)
- [x] Docker/Nginx/SSL deployment
- [x] **Analytics Engine v1.0.0** — Refactoring complet
  - [x] navixy_client.py (client API centralisé avec audit)
  - [x] cache_manager.py (cache par tenant)
  - [x] analytics_engine.py (moteur KPI strict)
  - [x] server.py refactoré (routes uniquement)
  - [x] Suppression de TOUT random/fake data
  - [x] Objet _audit sur toutes les réponses
  - [x] Configuration carburant par tenant (GET/PUT/DELETE)
  - [x] Frontend synchronisé (metrics.js v2, tous onglets)
  - [x] Tests: Backend 10/10, Frontend 6/6

## Backlog
- [ ] **Page Audit** (Super Admin) — Tableau comparatif Dashboard vs Navixy brut (P0)
- [ ] **Mode Debug Développeur** — Tooltip KPI: endpoint, temps réponse, cache age (P1)
- [ ] **Config avancée carburant** — Par type (diesel/essence/électrique), historique (P1)
- [ ] Intégration Baubit (Arc-Logiciels) — Attente doc API (P2)
- [ ] Responsive mobile (P2)
- [ ] Auto-refresh temps réel (P2)
- [ ] Export PDF (P2)
