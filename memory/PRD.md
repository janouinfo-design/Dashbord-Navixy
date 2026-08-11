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

## Logo LOGITRAK (iter 14d)
- Logo genere (badge noir arrondi, camion blanc + pin GPS emeraude), fond blanc converti en transparent
- Fichiers: /app/frontend/public/logo-logitrak.png + /app/backend/assets/logo-logitrak.png (copies separees
  car containers frontend/backend distincts au deploiement)
- Header dashboard: logo 36px a gauche du titre (header-logo); Sidebar.jsx aussi equipe (composant non utilise)
- PDF: logo 14mm a gauche du titre via Table (fallback sans logo si fichier absent)
- LEÇON image gen: le mode transparent peut incruster un damier en pixels — demander fond blanc opaque puis detourer

## Export PDF enrichi (iter 14c)
- /api/export/pdf enrichi: photos garage embarquees (avatars, telechargement parallele, echecs ignores),
  plaque sous le nom du vehicule, section "Echeances administratives" (leasing Mongo, assurance garage
  fallback Mongo, prochain controle non effectue — texte colore rouge/orange/vert), section
  "Eco-conduite — notation native" (score moyen, table conducteurs: score /100 + etoiles n/5 + penalites/100km)
- Generation ~19s hors cache (rapport plugin 46), <2s en cache; timeout frontend export porte a 120s
- Verifie par extraction texte pypdf: toutes les sections presentes avec donnees reelles

## Liaison garage depuis LOGITRAK (iter 14b)
- POST /api/vehicles/admin/navixy-garage/{vehicle_id}/link {tracker_id|null} — lie/delie (vehicle/update)
- UI: fiche vehicule non lie → panneau ambre avec selecteur des vehicules garage non lies + "Lier ce vehicule";
  vehicule lie → bouton "Delier" sous la section garage
- Cycle link/unlink teste par curl (Mini ONE ↔ Tab Samsung, restaure)
- AUCUNE association auto: les 5 vehicules garage (Mini ONE, PM-5 Citroen, smart R, Mercedes, FR 75)
  ne matchent aucun traceur libre par nom/plaque — paires a faire par l'utilisateur via l'UI

## Synchronisation Garage (iter 14) — BIDIRECTIONNELLE
- Source commune = garage plateforme GPS (vehicle/list|read|update|avatar/upload) — UI dit "garage LOGITRAK"
- Correspondance par tracker_id (3 lies: 781479 Audi/164367, 3076994 Skoda, 3131157 Toyota; 5 non lies)
- Champs 2 sens: nom, modele, plaque, VIN, annee, couleur, assurance RC (n° police + valide jusqu'au), PHOTO
- Pull auto a chaque chargement page Vehicules + bouton Synchroniser (banniere noire, pastille verte)
- Push: edition fiche → PUT /api/vehicles/admin/navixy-garage/{vehicle_id} (read-merge-update complet)
- Photo: upload via fiche (hover camera) → vehicle/avatar/upload → URL statique publique {api}/static/vehicle/avatars/{fn}
- Champs internes Mongo NON synchronises: leasing, responsable, base, controles, etat des lieux, documents
- Badge assurance liste/fiche: date garage prioritaire, fallback Mongo
- White-label: cleanDeviceLabel() masque 'navixy' dans les modeles traceurs (VehiclesTab + AnalyseFlotteTab)
- ATTENTION: pas d'endpoint delete avatar — la photo test (carre bleu) sur l'Audi doit etre remplacee par l'utilisateur
- LEÇON: verifier les fins de fichier apres gros search_replace (2 fois du code residuel a casse la compilation)
- Tests: iteration_14.json — backend 100% (6/6, restaurations donnees reelles OK); 3 bugs ligne corriges
  post-rapport et verifies par screenshot cible (photo, sous-ligne plaque, badge garage, leak white-label)

## Onglet Vehicules — MODULE ADMINISTRATIF (iter 13)
- Liste type "Documents": plaque + marque/modele, km GPS reels (total_odometer), responsable,
  badges echeances Leasing/Assurance/Controle (rouge=echu, orange<30j, vert sinon, gris si vide)
- Fiche vehicule (drawer 7 onglets): General (marque/modele/annee/VIN/base/responsable/maintenances
  + readonly km GPS/groupe/tracker), Leasing, Assurance, Carte grise, Etat des lieux (entrees datees),
  Controles (echeances + marquer effectue), Documents (upload fichiers max 25 Mo)
- Backend: /app/backend/vehicle_admin.py — routeur /api/vehicles/admin, collection Mongo vehicle_admin
  (tenant + tracker_id), uploads disque /app/backend/uploads/{tenant}/{tracker_id}/
- Donnees admin = saisie utilisateur (affichees comme telles); km/tracker = GPS reel
- Cles vides omises a l'upsert; data-testid complets (etat-del-* ajoute post-test)
- Tests: iteration_13.json — 100% backend (9/9) + 100% frontend, donnees de test nettoyees

## Onglets supprimes (iter 12c)
- Onglets "Couts" et "IoT" RETIRES de la navigation (demande utilisateur)
- Fichiers CostsTab.jsx / IoTTab.jsx conserves sur disque mais non importes (retour facile si besoin)
- Endpoints backend carburant/config conserves — le taux configure continue d'alimenter les calculs CHF
- References "onglet Couts" nettoyees dans OverviewTab (lien navigation retire) et AnalyseFlotteTab
- Onglets restants: Vue generale, Analyse flotte, Conducteurs, Vehicules (+ Audit en ?admin=true)

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
- [x] **Audit multi-tenant Phase 1** (2026-06): rapport complet /app/memory/AUDIT_MULTITENANT.md, valide par utilisateur
- [x] **Phase 1 securite multi-tenant** (2026-06, iteration_15 — 23/23 backend + frontend 100%):
  - Auth JWT (cookies httpOnly access 8h + refresh 7j, fallback Bearer), bcrypt, /api/auth/{login,logout,me,refresh}
  - TOUS les endpoints /api/* verrouilles (sauf /api/, /api/client/info publics — branding login)
  - Fuites corrigees: /admin/clients SUPER_ADMIN only + navixy_hash jamais renvoye; flows filtres par tenant; debug/cache-stats + audit/compare SUPER_ADMIN
  - navixy_hash chiffre au repos (Fernet, prefixe enc:, cle ENCRYPTION_KEY .env)
  - Sous-domaines *.logitrak.ch inconnus → 403; tenant = identite du token (jamais le frontend); SUPER_ADMIN: X-Act-As-Tenant valide + journalise (impersonation_logs)
  - Brute force: 5 echecs → 429 verrou 15 min; index Mongo (users.email unique, clients.subdomain unique, flows.tenant)
  - Seed SUPER_ADMIN idempotent depuis .env (SUPER_ADMIN_EMAIL/PASSWORD) — identifiants dans /app/memory/test_credentials.md
  - Frontend: LoginPage, AuthContext, interceptor 401→refresh, logout header, onglet Audit reserve SUPER_ADMIN (plus de ?admin=true)
  - Fichiers: backend/auth.py (nouveau), server.py, frontend/src/lib/{api.js,AuthContext.jsx}, components/auth/LoginPage.jsx, App.js, Header.jsx, DashboardLayout.jsx
  - Tests regression: /app/backend/tests/test_auth_phase1.py
- [x] **Phase 2 Super Admin** (2026-06, iteration_16 — 29/29 backend + frontend 100%):
  - Routes frontend: /super-admin (dashboard KPI reels), /super-admin/clients (table/recherche/filtres/tri/pagination/actions), /super-admin/clients/:id (fiche: Vue generale/Utilisateurs/Navixy/Modules/Activite) — react-router 7
  - Wizard 5 etapes: Entreprise (slug auto modifiable) → Admin (mdp temporaire affiche 1x) → Navixy (test connexion backend reel) → Modules (6 reels) → Validation ; creation atomique POST /api/admin/clients/full avec rollback
  - Backend super_admin.py: /api/admin/{overview,modules,navixy/test,clients/full,clients/{id}/detail|activity|users|suspend|reactivate|modules|purge,users/{uid},users/{uid}/reset-password,impersonation/start|end}
  - Impersonation: header X-Act-As-Tenant (SUPER_ADMIN only, ignore sinon), bandeau orange constant, journal impersonation_logs (super_admin_id, tenant, ip, started/ended_at)
  - RBAC durci: READ_ONLY/DRIVER → 403 sur ecritures ; client suspendu → 403 login + requetes ; modules non actives → 403 endpoints (conducteurs/vehicules/carburant/rapports) + onglets caches ; SUPER_ADMIN jamais attribuable cote client (400)
  - Migration: clients.tenant (Hermus=default, hash conserve), clients.modules, tenant_sync, audit_log ; index tenant_sync.tenant unique, audit_log(tenant,at)
  - 2 tenants TEST conserves (test-alpha modules partiels, test-beta complet, hash factices → Navixy 'En erreur' = etat reel) — purgeables via fiche client
  - Fichiers: backend/{super_admin.py(nouveau),auth.py,server.py}, frontend/src/components/superadmin/* (7 fichiers), shared/ImpersonationBanner.jsx, App.js, AuthContext.jsx, api.js, DashboardLayout.jsx
  - Tests: /app/backend/tests/test_super_admin_phase2.py (regression reutilisable)

## Backlog
- [ ] **P3 restant**: correlation stricte is_impersonating avec log ouvert (suggestion test agent, non bloquant) ; changement de mot de passe par l'utilisateur (must_change_password est stocke mais non force au login)
- [ ] **P4 Durcissement**: revue finale securite
- [ ] Alertes email echeances (explicitement hors perimetre Phase 2)
- [x] **Phase 2.1 Durcissement auth & impersonation** (2026-06, iteration_17 — 20/20 backend + frontend 100%):
  - Changement mdp obligatoire: must_change_password → 403 PASSWORD_CHANGE_REQUIRED partout sauf /api/auth/* ; page /change-password (redirect force, contournement URL impossible) ; POST /api/auth/change-password (verif mdp actuel, min 8, bcrypt, invalidation sessions, nouvelles cookies)
  - Rotation refresh tokens: collection sessions (jti, sha256 hash — jamais en clair, TTL index) ; chaque refresh consomme l'ancien et emet un nouveau ; reutilisation → revocation globale + audit REFRESH_REUSE_DETECTED ; logout revoque
  - Impersonation stricte: header X-Act-As-Tenant exige session impersonation_logs OUVERTE du super admin pour CE tenant (403 IMPERSONATION_INVALID sinon) ; 1 seule session ouverte par super admin ; expiration 60 min (IMPERSONATION_EXPIRED, log expired=true) ; frontend auto-nettoie sur 403 (interceptor)
  - Audit: LOGIN_SUCCESS, LOGIN_FAILED_LOCKOUT, PASSWORD_CHANGED, PASSWORD_RESET_BY_ADMIN, USER_DISABLED, USER_REACTIVATED, IMPERSONATION_STARTED/ENDED/EXPIRED, REFRESH_REUSE_DETECTED — aucun secret stocke (teste)
  - Comptes TEST passes par le flux change-password reel — nouveaux mdp dans test_credentials.md
  - Fichiers: backend/{auth.py,server.py,super_admin.py}, frontend/{components/auth/ChangePasswordPage.jsx(nouveau),App.js,lib/api.js,lib/AuthContext.jsx}
  - Tests: /app/backend/tests/test_auth_phase2_1.py (20 tests)

## Ordre valide par utilisateur pour la suite
1. Carte temps reel (module 'carte' a ajouter au registre MODULES)
2. Alertes echeances email
3. Logo/branding par client

- [x] **Phase 2.2 Correction architecture — acces client sans login** (2026-06, iteration_18 — backend 28/28 pytest + frontend 100%):
  - Lien d'acces tenant signe: token 256 bits urlsafe, stocke HACHE sha256 (tenant_access_tokens), sans expiration, revocable, regeneration revoque l'ancien
  - GET /api/access/{token} (public): valide token + client actif + host (si sous-domaine prod), pose les cookies httpOnly (session refresh rotative), audit ACCESS_LINK_USED avec IP
  - Utilisateur virtuel 'link:<id>': access_mode 'edit' → role MANAGER, 'read' → READ_ONLY — tout le RBAC/modules/suspension/isolation existant s'applique ; change-password interdit ; revocation = 401 immediat (verif du lien a chaque requete + au refresh)
  - Super Admin: fiche client onglet 'Lien d'acces' (generer/copier une fois/revoquer/mode) ; endpoints POST|DELETE /api/admin/clients/{id}/access-link ; audit ACCESS_LINK_CREATED/REVOKED
  - ADMIN_HOST (env, optionnel — production): tous les endpoints SUPER_ADMIN → 403 hors de ce host ; inactif en preview ; ajoute au docker-compose (${ADMIN_HOST:-})
  - Frontend: route publique /access/:token (AccessPage), header sans logout/email pour via_link
  - Usage prod: le lien remplace l'URL nue dans le panneau Navixy white-label (login.logitrak.fr) — le client entre sans login, cle Navixy jamais exposee
  - Clarification auditee: Techlift n'a jamais eu de privileges — le Super Admin est global (/super-admin), le login vu sur techlift.logitrak.ch etait le formulaire generique brande
  - Fichiers: backend/{auth.py,server.py,super_admin.py,docker-compose.yml}, frontend/{components/auth/AccessPage.jsx(nouveau),App.js,superadmin/ClientDetail.jsx,layout/Header.jsx}
  - Tests regression: /app/backend/tests/test_access_link.py (28 tests)
  - Bug corrige post-test: refresh des sessions lien (branche 'link:' dans /auth/refresh) — re-teste 28/28
- [x] **Phase 2.2 Validation reelle du parcours sans login + fix confidentialite token** (2026-06, iteration_20 — 30/30, backend 28/28 pytest + frontend 100%):
  - Faille corrigee (iteration_19 29/30): le token vivait dans la route SPA /access/<token> → visible par PostHog/analytics
  - GET /api/access/{token} = echange 100% backend: 302 Location:'/' + cookies HttpOnly + Cache-Control:no-store + Referrer-Policy:no-referrer — le SPA/navigateur ne voit JAMAIS le token
  - Erreurs = 302 vers /lien-invalide (invalide/revoque), ?motif=suspendu, ?motif=domaine — sans cookies ; page neutre FR sans jargon (AccessPage.jsx reecrite)
  - Route SPA /access/:token SUPPRIMEE (App.js) ; PostHog ENTIEREMENT SUPPRIME de public/index.html
  - Logs: filtre _AccessTokenLogFilter (server.py) → '/api/access/[REDACTED]' dans uvicorn ; anciens logs purges ; nginx-dashboard.conf: location /api/access/ avec access_log off (a deployer VPS)
  - URL generee Super Admin: https://<sub>.logitrak.ch/api/access/<token>
  - Durcissement minor: /auth/me des sessions lien verifie aussi client.is_active (401 si suspendu)
  - Valide 30/30: URL finale sans token, zero requete posthog, F5/onglets/refresh, edit/read 403, revocation, suspension+reactivation, isolation X-Act-As ignore, Mongo hash-only, non-regression logins
  - IMPORTANT DEPLOIEMENT VPS: regenerer le lien Techlift apres deploiement (ancien format /access/<token> obsolete) + git pull de nginx-dashboard.conf
- [ ] Integration Baubit (P2)
- [ ] Responsive mobile/tablette complet (P2)
- [ ] Auto-refresh (P2)
- [ ] Reverse geocoding positions (P3)
