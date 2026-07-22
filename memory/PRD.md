# LOGITAG Dashboard - PRD

## Architecture
- **Un seul Dashboard** avec 8 onglets horizontaux (7 standard + 1 Audit admin)
- **Onglets** : Vue générale | Performance | Efficacité | Conducteurs | Véhicules | Coûts | IoT | Audit (admin)

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

## Frontend Structure
```
App.js → DashboardLayout.jsx
  Header (debug toggle, PDF export, refresh)
  Tabs (7 standard + Audit via ?admin=true)
  tabs/
    OverviewTab.jsx     (KPIs réels + debug overlay, Insights, Charts)
    PerformanceTab.jsx  (Utilisation, Radar, Top 10 distance)
    EfficiencyTab.jsx   (Utilisation % par véhicule, jours actifs)
    DriversTab.jsx      (Score utilisation, Classement, Détail drawer)
    VehiclesTab.jsx     (KPIs cliquables, Table, Détail expandable)
    CostsTab.jsx        (Config carburant UI inline, KPIs financiers)
    IoTTab.jsx          (Flow editor)
    AuditTab.jsx        (Comparaison Dashboard vs Navixy brut)
  shared/
    UIComponents.jsx    (KPICard avec debugInfo overlay)
  lib/
    api.js
    metrics.js          (v2 — utilization_score, null-safe)
```

## API Endpoints
| Endpoint | Description | Source |
|---|---|---|
| GET /api/fleet/stats | Kilométrage, odomètre, heures moteur, état GPS | Navixy |
| GET /api/fleet/efficiency | Utilisation %, jours actifs, état mouvement | Navixy |
| GET /api/analytics/trends | Distance quotidienne, véhicules actifs | Navixy |
| GET /api/analytics/vehicle-comparison | Utilisation 7j, distance totale | Navixy |
| GET /api/fleet/idle-by-group | Ralenti par groupe d'engins | Navixy |
| GET /api/reports/driver | Conducteurs et véhicules assignés | Navixy |
| GET /api/config/fuel | Configuration carburant par tenant | MongoDB |
| PUT /api/config/fuel | Modifier prix/taux carburant | MongoDB |
| DELETE /api/config/fuel | Reset config carburant | MongoDB |
| GET /api/audit/compare | Comparaison Engine vs Navixy brut | Navixy×2 |
| GET /api/export/pdf | Rapport PDF branded | reportlab |
| GET /api/debug/cache-stats | Stats du cache | Interne |

## Multi-Client
- dashboard.logitrak.ch, guimet.logitrak.ch, membrez.logitrak.ch
- Script add-client.sh pour ajout automatisé

## Completed
- [x] Architecture SaaS avec onglets horizontaux
- [x] Backend optimisé (parallel + cache tenant-isolé)
- [x] Multi-client (3 clients + add-client.sh)
- [x] Docker/Nginx/SSL deployment
- [x] **Analytics Engine v1.0.0** — Refactoring complet, zero fake data
- [x] **Page Audit** — Comparaison véhicule par véhicule (Engine vs Navixy brut), accessible via ?admin=true
- [x] **Mode Debug** — Toggle dans le header, overlay sur KPI cards (endpoint, temps réponse, cache, field)
- [x] **Config Carburant UI** — Panneau inline dans l'onglet Coûts (prix/L, taux L/100km, sauvegarder)
- [x] **Export PDF** — Rapport branded avec résumé + tableau véhicules (reportlab)
- [x] Tests: Backend 12/12, Frontend 100%

## Backlog
- [ ] Intégration Baubit (Arc-Logiciels) — Attente doc API (P2)
- [ ] Responsive mobile (P2)
- [ ] Auto-refresh temps réel (P2)
- [ ] Export PDF avancé (graphiques intégrés) (P3)
