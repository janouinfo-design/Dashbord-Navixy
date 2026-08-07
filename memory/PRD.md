# LOGITAG Dashboard - PRD

## Architecture
- **Un seul Dashboard** avec 8 onglets (7 standard + 1 Audit admin)
- **Onglets** : Vue generale | Performance | Efficacite | Conducteurs | Vehicules | Couts | IoT | Audit

## Backend Architecture (Analytics Engine v1.0.0)
```
/app/backend/
├── server.py              # Routes API
├── navixy_client.py       # Client API Navixy centralise
├── analytics_engine.py    # Moteur KPI strict
├── cache_manager.py       # Cache isole par tenant
```

### Regles strictes
1. ZERO donnees aleatoires — tout de Navixy
2. Audit trail (_audit) sur chaque reponse
3. Donnee indisponible → null (frontend: "N/A")
4. Prix carburant configurable par tenant (defaut: 2.00 CHF/L)
5. Cache isole par tenant (TTL 5 min)
6. **TOUS les endpoints utilisent les memes from_date/to_date** (coherence garantie)

### Coherence KPI (§17 — RESOLU)
Les 4 endpoints principaux retournent les memes distances pour les memes dates :
- fleet/stats, vehicle-comparison, trends, efficiency
- Tous acceptent from_date + to_date explicites
- Plus aucun hardcoding de periodes

## Vue Generale (Refonte Complete)

### 6 KPI Cliquables
1. **Utilisation Flotte** → Drawer: breakdown par vehicule, jours actifs, distance
2. **Vehicules actifs** → Drawer: tous vehicules avec statut, derniere comm, distance
3. **Distance parcourue** → Drawer: total, moy/vehicule, plus/moins actif, ventilation
4. **Heures moteur** → Drawer: compteurs par vehicule
5. **En mouvement** → Drawer: vehicules en deplacement (instantane)
6. **Hors ligne** → Drawer: vehicules offline avec duree, derniere comm, modele tracker

### Insights Operationnels (Cliquables)
- Vehicules hors ligne (avec CTA "Voir les N vehicules")
- Vehicules sans activite (0 km)
- Vehicules sous-utilises (<30%)
- Vehicule le plus utilise

### DashboardDetailDrawer
Composant generique reutilisable pour tous les drill-downs.

## API Endpoints
| Endpoint | Params | Description |
|---|---|---|
| GET /api/fleet/stats | from_date, to_date | Stats flotte |
| GET /api/fleet/efficiency | from_date, to_date | Utilisation |
| GET /api/analytics/trends | from_date, to_date | Tendances jour/jour |
| GET /api/analytics/vehicle-comparison | from_date, to_date | Comparaison vehicules |
| GET /api/fleet/idle-by-group | — | Ralenti engins |
| GET /api/reports/driver | from_date, to_date | Rapport conducteurs |
| GET /api/config/fuel | — | Config carburant |
| PUT /api/config/fuel | body | Modifier config |
| DELETE /api/config/fuel | — | Reset config |
| GET /api/audit/compare | from_date, to_date | Audit Engine vs Navixy |
| GET /api/export/pdf | from_date, to_date | Rapport PDF |

## Completed
- [x] Architecture SaaS onglets horizontaux
- [x] Backend optimise (parallel + cache tenant-isole)
- [x] Multi-client (3 clients + add-client.sh)
- [x] Docker/Nginx/SSL deployment
- [x] Analytics Engine v1.0.0 (zero fake data)
- [x] Page Audit (Super Admin)
- [x] Mode Debug (toggle header)
- [x] Config Carburant UI (onglet Couts)
- [x] Export PDF (reportlab)
- [x] **Refonte Vue Generale** :
  - [x] 6 KPI cliquables avec drawers detailles
  - [x] Insights operationnels cliquables
  - [x] DashboardDetailDrawer generique
  - [x] Correction incoherence §17 (dates uniformes)
  - [x] PeriodSelector corrige (7j = today-6)
  - [x] Tests: Backend 17/17, Frontend 100%

## Backlog
- [ ] Integration Baubit (Arc-Logiciels) — Attente doc API (P2)
- [ ] Responsive mobile (P2)
- [ ] Auto-refresh temps reel (P2)
- [ ] Export PDF avance (graphiques integres) (P3)
- [ ] Partage mileage cache entre endpoints (optimisation cold-cache) (P3)
