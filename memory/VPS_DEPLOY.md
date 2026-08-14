# VPS LOGITRAK — infos de déploiement

- Chemin du projet sur le VPS : `/opt/navixy-dashboard/Navixy`
- URL production : https://dashboard.logitrak.ch (+ sous-domaines clients *.logitrak.ch)
- Conteneurs : navixy-backend, navixy-frontend, navixy-mongodb (docker compose)

## Commande de redéploiement standard (après Save to GitHub)
```bash
cd /opt/navixy-dashboard/Navixy && git pull && docker compose build backend frontend && docker compose up -d backend frontend && docker compose ps
```
- Rebuild backend seul ou frontend seul selon les fichiers modifiés.
- MongoDB ne se redémarre jamais lors d'un déploiement.
- Nginx : config dans /etc/nginx/sites-available/dashboard.logitrak.ch (recharger si nginx-dashboard.conf change : `nginx -t && systemctl reload nginx`).
- Les seeds preview (tenant demo-ev : échéances + documents fictifs) n'existent PAS sur le VPS.
