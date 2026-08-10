# AUDIT MULTI-TENANT / SUPER ADMIN — LOGITRAK Fleet Dashboard
Phase 1 — aucun code modifié. Généré pour validation avant implémentation.

## 1. Architecture actuelle
- Frontend: React 19 + Tailwind + shadcn, SPA sans routing (onglets), tabs: Vue générale, Analyse flotte, Conducteurs, Véhicules (+ Audit via ?admin=true).
- Backend: FastAPI monolithique (server.py ~800 l.) + modules: navixy_client, analytics_engine, cache_manager, ecodriving, vehicle_admin.
- DB: MongoDB (motor). Collections: clients(1), tenant_config(1), vehicle_admin(1), flows(1) + fichiers disque /app/backend/uploads/{tenant}/.
- Pas de workers, pas de WebSocket, pas de background jobs. Cache = in-memory par process, TTL 300s.
- Déploiement: docker-compose + nginx par sous-domaine + add-client.sh.

## 2. Authentification actuelle
- AUCUNE. Pas de login, pas d'utilisateurs, pas de JWT, pas de sessions.
- Le "tenant" est déduit UNIQUEMENT du header Host (sous-domaine) → db.clients {subdomain, is_active} → navixy_hash.
- Fallback: pas de sous-domaine → tenant='default' + DEFAULT_NAVIXY_HASH (.env).

## 3. Rôles actuels
- AUCUN. ?admin=true (frontend uniquement) affiche l'onglet Audit — les API restent ouvertes.

## 4. Collections concernées
| Collection | tenant-aware ? | Détail |
|---|---|---|
| clients | n/a (registre) | id uuid, name, subdomain, navixy_hash EN CLAIR, logo_url, primary_color, contact_email, is_active, created_at |
| tenant_config | OUI ({tenant}) | fuel_config par tenant |
| vehicle_admin | OUI ({tenant, tracker_id}) | fiches admin + contrôles + états + documents |
| flows | NON — FUITE | IoT flows sans champ tenant, partagés entre tous |
| status_checks | NON | données de démo, sans valeur |
| uploads disque | OUI (/{tenant}/) | fichiers documents |
- Données métier (véhicules, trajets, événements, scores) = PAS en base : lues en direct dans Navixy via le hash du tenant → isolation naturelle par compte Navixy.

## 5. Endpoints (~35) — état d'isolation
- Corrects (get_tenant_context systématique): /client/info, /config/fuel*, /trackers, /tracker/*, /groups, /employees, /fleet/*, /analytics/*, /reports/driver, /drivers/ecodriving, /map/*, /export/*, /audit/compare, /vehicles/admin/** (Mongo filtré tenant).
- CRITIQUES (aucune protection):
  1. GET /api/admin/clients → liste TOUS les clients AVEC navixy_hash en clair. Fuite maximale.
  2. POST/PUT/DELETE /api/admin/clients → n'importe qui crée/modifie/supprime des tenants.
  3. /api/flows CRUD → collection globale sans tenant (fuite inter-clients).
  4. /api/debug/cache-stats → expose la liste des tenants et clés de cache.
  5. /api/audit/compare + /api/vehicles/admin (écriture) + /api/config/fuel (écriture) + upload documents → ouverts à quiconque connaît l'URL du sous-domaine.
- TOUT endpoint est accessible sans authentification: le Host header suffit.

## 6. Fonctionnement Navixy actuel
- 1 hash par tenant (clients.navixy_hash, fallback .env). navixy_client.request(hash) par appel — pas d'état partagé.
- Caches: TenantCacheManager déjà cloisonné par tenant (équivalent navixy:{tenant}:key demandé).
- Rapports plugin 46 générés/supprimés à la volée avec le hash du tenant. Uploads avatars → compte Navixy du tenant.
- Provider unique hardcodé (Navixy), pas d'abstraction provider.

## 7. Où ajouter tenant_id
- flows (champ tenant + filtrage + index).
- Nouvelles collections à créer: users (tenant_id, role), impersonation_logs, tenant_modules (ou champ modules dans clients), audit_log.
- clients à enrichir: status(actif/suspendu), contact, phone, address, country, timezone, modules[], provider config chiffrée, updated_at.

## 8. Risques de fuite inter-clients (par gravité)
1. navixy_hash de tous les clients exposé via /api/admin/clients (CRITIQUE).
2. Absence totale d'authentification: URL du sous-domaine = accès complet lecture/écriture (CRITIQUE).
3. flows partagés entre tenants (ÉLEVÉ).
4. debug/cache-stats fuit la topologie des tenants (MOYEN).
5. Suppression d'un client sans auth → déni de service tenant (ÉLEVÉ).
6. tenant 'default' fallback: tout host inconnu retombe sur les données du client par défaut (MOYEN — à restreindre).

## 9. Impact frontend
- Ajouter: page /login, contexte auth (token), guard de routes, page /super-admin (dashboard + clients + wizard), bandeau impersonation, masquage menu par modules, gestion rôles UI.
- Existant conservé tel quel: les 4 onglets clients ne changent pas (seul l'accès devient authentifié). Onglet Audit → réservé SUPER_ADMIN.
- Introduire react-router (actuellement pas de routes) — sans toucher au contenu des onglets.

## 10. Impact backend
- Middleware/dépendance auth JWT: identité → user → tenant_id + rôle (le tenant ne vient PLUS seulement du Host; le Host doit CONCORDER avec le tenant du token, sauf SUPER_ADMIN).
- Protéger /admin/clients (SUPER_ADMIN uniquement), masquer navixy_hash de toutes les réponses.
- Chiffrer navixy_hash au repos (Fernet, clé en .env).
- flows: + tenant. debug/cache-stats: SUPER_ADMIN. RBAC par dépendance (require_role).
- Impersonation: token scoped {sub: super_admin_id, act_as_tenant, exp court} + collection impersonation_logs.
- Modules par tenant: dépendance require_module(name) sur les routes concernées.
- Abstraction provider: table de config {provider:'navixy', credentials chiffrées} — préparation sans refactor massif.

## 11. Impact workers / cache / WebSocket
- Aucun worker ni WebSocket → rien à migrer.
- Cache déjà tenant-isolé; à faire: invalidation à la suspension d'un tenant + interdiction du fallback 'default'.

## 12. Stratégie de migration (sans perte)
1. Créer le tenant officiel du client actuel dans clients (reprendre le hash .env) — ou réutiliser le doc existant.
2. Script idempotent: flows sans tenant → tenant='default'; vérifier vehicle_admin/tenant_config (déjà 'default').
3. Renommage logique: conserver tenant='default' comme identifiant interne, exposer un nom d'affichage propre.
4. Créer users: 1 SUPER_ADMIN LOGITRAK + 1 ADMIN pour le client actuel (mots de passe fournis par toi, stockés hashés).
5. Index: clients.subdomain (unique), users.email (unique), users.tenant_id, vehicle_admin (tenant+tracker_id, déjà requêté ainsi), flows.tenant, impersonation_logs.tenant_id+started_at.
6. Rollback: champs additifs uniquement, aucune suppression; sauvegarde mongodump avant migration; le code actuel reste compatible (les nouveaux champs sont ignorés par l'ancien code).

## 13. Architecture cible
- clients (=tenants) enrichi + chiffrement credentials + modules[] + status.
- users {id, tenant_id|null(super), email, password_hash, role, first/last name, is_active, created_at}.
- Rôles: SUPER_ADMIN, ADMIN, MANAGER, READ_ONLY, DRIVER (matrice permissions par endpoint).
- Auth: JWT access (+ refresh), bcrypt. Intégration via playbook auth (integration_expert) au moment de coder.
- Résolution tenant: token → tenant_id; contrôle croisé avec sous-domaine; SUPER_ADMIN: header X-Act-As-Tenant validé + journalisé.
- /super-admin (frontend): dashboard KPI réels (comptes en base + test hash Navixy par tenant pour "connexion active/erreur" + dernière synchro = timestamp dernier appel réussi par tenant, à journaliser), page clients (table, recherche, filtres, actions), wizard 3 étapes avec TESTER LA CONNEXION (appel réel user/get_info ou tracker/list avec le hash saisi).
- Design: mêmes composants/thème clair existants.

## 14. Plan d'implémentation par phases
- P1 (fondation sécurité): users + JWT + login + bcrypt; verrouillage de TOUS les endpoints; rôles; correction fuites (admin/clients, flows.tenant, cache-stats, masquage hash); chiffrement hash. Tests isolation.
- P2 (super admin): /super-admin dashboard + clients + wizard + test connexion + suspension. Journal de synchro par tenant.
- P3 (modules + impersonation): activation modules par tenant (API + menu), mode aperçu client audité.
- P4 (durcissement): tests IDOR croisés automatisés (tenant A vs B), READ_ONLY, DRIVER, exports/documents, revue finale.
Chaque phase: testing agent + validation utilisateur avant la suivante.

## 15. Tests de non-régression prévus
- Les 4 onglets client (données réelles Navixy) inchangés après login.
- PDF/exports, fiches véhicules, sync garage, éco-conduite: identiques.
- Matrice: A→A OK, A→B REFUS (URL/ID/query/payload), B→A REFUS, ADMIN A→admin B REFUS, READ_ONLY→écriture REFUS, SUPER_ADMIN→A/B OK, impersonation A→contexte A uniquement + journal.
- Suspension tenant → accès coupé + cache invalidé.
