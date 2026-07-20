# LOGITAG Dashboard - PRD

## Architecture SaaS
- **Un seul Dashboard** avec 6 onglets horizontaux
- **Sidebar** : Dashboard, Documents, Livre de bord, Alertes, Parametres
- **Onglets** : Vue generale | Performance | Conducteurs | Vehicules | Couts | IoT

## Component Structure
```
App.js → Sidebar + DashboardLayout
  DashboardLayout.jsx → Header + Tabs + Tab Content
    tabs/
      OverviewTab.jsx  (KPIs, Insights, Charts, Engins ralenti)
      PerformanceTab.jsx (Score, Radar, Evolution, Top 10)
      DriversTab.jsx (KPIs, Classement, Detail drawer)
      VehiclesTab.jsx (KPIs cliquables, Table, Detail expandable)
      CostsTab.jsx (Financier only, Economies, Donut)
      IoTTab.jsx (Flow editor drag-and-drop)
  shared/
    UIComponents.jsx (KPICard, InsightCard, ScoreBadge, etc.)
    PeriodSelector.jsx
  lib/
    api.js
    metrics.js (calculs frontend)
```

## Multi-Client
- dashboard.logitrak.ch (17 vehicules)
- guimet.logitrak.ch (4 vehicules)
- membrez.logitrak.ch (202 vehicules)
- Script add-client.sh pour ajout automatise

## Backend Optimizations
- Parallel API calls (asyncio.gather, 15 at a time)
- 5-minute cache in memory
- Batch mileage/odometer/engine hours APIs

## Completed
- [x] Architecture SaaS avec onglets horizontaux
- [x] Vue generale (KPI, Insights, Engins ralenti, Charts)
- [x] Performance (Radar, Evolution, Top 10, zero finance)
- [x] Conducteurs (Score, Drawer radar, Filtres)
- [x] Vehicules (KPI cliquables, Table expandable)
- [x] Couts (Financier only, Economies possibles)
- [x] IoT (Flow editor)
- [x] Multi-client (3 clients actifs)
- [x] Backend optimise (parallel + cache)

## Backlog
- [ ] Integration Baubit (attente doc API)
- [ ] Responsive mobile
- [ ] Auto-refresh temps reel
- [ ] Export PDF
