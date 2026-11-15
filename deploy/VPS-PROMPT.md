# Prompt para desplegar la API NinaCal en un VPS con OpenCode

Copia este bloque en OpenCode dentro del VPS. Antes de ejecutarlo, reemplaza los valores de
`API_DOMAIN` y `DATA_TAR` (o indica que el archivo se transferirá después).

```text
Actúa como OpenCode en un VPS Linux. Despliega la API NinaCal con Docker, TLS y los datos
0.05° ya calculados. No inventes datos, no subas datos a Git, no expongas el puerto 8080
públicamente y no imprimas secretos.

Parámetros de entrada (confírmalos antes de empezar):
- REPO=https://github.com/hanserlodev/ninacal.git
- APP_DIR=/opt/ninacal
- API_DOMAIN=<dominio, por ejemplo api.midominio.com o 203.0.113.10.sslip.io>
- DATA_TAR=/tmp/ninacal-data-005.tar.zst
- El bundle de datos vive en data/v2/ y NO está en Git (779 MB). Si DATA_TAR no existe,
  detente y pide al usuario que lo transfiera; no generes datos sintéticos.

Reglas:
- Usa sudo solo cuando sea necesario.
- No borres data/v2 ni backend/data/ninacal.sqlite sin confirmación.
- Mantén el puerto 8080 escuchando solo en 127.0.0.1; Caddy publica 80/443.
- Al final entrégame la URL pública, la salida de /health y los pasos pendientes.

1) Inspecciona el sistema
   cat /etc/os-release
   uname -m; free -h; df -h /
   Si no es Debian/Ubuntu, adapta los comandos y avísame.

2) Instala Docker Engine y el plugin Compose
   apt-get update
   apt-get install -y ca-certificates curl gnupg git python3 ufw
   curl -fsSL https://get.docker.com | sh
   systemctl enable --now docker
   usermod -aG docker "$USER" 2>/dev/null || true
   docker --version
   docker compose version || apt-get install -y docker-compose-plugin
   docker run --rm hello-world
   Nota: si el grupo docker requiere re-login, usa `sudo docker` en los pasos siguientes.

3) Firewall
   ufw allow OpenSSH
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw --force enable
   ufw status verbose
   No abras 8080. Comprueba que el puerto de la API no responde desde fuera.

4) Código
   git clone REPO APP_DIR
   cd APP_DIR
   git log -1 --oneline
   test -f docker-compose.yml
   test -f backend/Dockerfile
   test -f deploy/Caddyfile

5) Datos
   Si existe DATA_TAR:
     tar -I zstd -xf "$DATA_TAR" -C "$APP_DIR"
   Si no, pide al usuario transferir `data/v2/` con rsync/scp y espera.
   Verifica:
     test -f data/v2/manifest.json
     python3 - <<'PY'
     import json
     m=json.load(open('data/v2/manifest.json'))
     assert m['resolution_degrees'] == 0.05, m['resolution_degrees']
     assert len(m['countries']) >= 12, list(m['countries'])
     print('data ok:', len(m['countries']), 'countries, resolution', m['resolution_degrees'])
     PY

6) Genera la base SQLite en el VPS (stdlib de Python, sin pip)
   cd APP_DIR
   python3 backend/scripts/build_db.py
   ls -lh backend/data/ninacal.sqlite
   Debe pesar ~1.3 GB y contener los 12 países.

7) Levanta la API en Docker
   cd APP_DIR
   docker compose build
   docker compose up -d api
   sleep 5
   docker compose ps
   docker compose logs --tail=80 api
   curl -fsS http://127.0.0.1:8080/health
   curl -fsS http://127.0.0.1:8080/api/countries | head -c 500; echo
   curl -fsS "http://127.0.0.1:8080/api/region?country=PE&start=2025&end=2025" | head -c 500; echo
   Si health falla, lee los logs y corrige antes de continuar.

8) DNS y TLS con Caddy
   Confirma que API_DOMAIN resuelve a la IP pública:
     dig +short "$API_DOMAIN"
   Instala Caddy (repo oficial) o usa el contenedor caddy:2.
   /etc/caddy/Caddyfile:
     API_DOMAIN {
         encode gzip zstd
         reverse_proxy 127.0.0.1:8080
     }
   caddy validate --config /etc/caddy/Caddyfile
   systemctl enable --now caddy
   systemctl reload caddy
   systemctl status caddy --no-pager
   Si no hay dominio propio, usa https://IP.sslip.io (Caddy puede emitir el certificado)
   y avísame de que es temporal.

9) Verifica desde fuera
   curl -fsS "https://$API_DOMAIN/health"
   curl -fsS "https://$API_DOMAIN/api/countries" | head -c 500; echo
   curl -fsS -o /dev/null -w '%{http_code}\n' \
     "https://$API_DOMAIN/data/boundaries/peru_adm1_simplified.geojson"
   curl -sI "https://$API_DOMAIN/api/region?country=BR&start=2025&end=2025" \
     | grep -i 'access-control-allow-origin'
   Comprueba que http://IP:8080 NO responde desde fuera.

10) Operación
   docker compose restart
   systemctl enable docker caddy
   Crea un backup diario fuera del repo:
     mkdir -p /var/backups/ninacal
     tar -I zstd -cf "/var/backups/ninacal/ninacal-$(date +%F).tar.zst" \
       data/v2 backend/data/ninacal.sqlite
   Añade un cron/systemd timer diario; no borres los backups automáticamente.
   Deja documentado cómo actualizar:
     rsync -avP data/v2/ usuario@VPS:/opt/ninacal/data/v2/
     python3 backend/scripts/build_db.py
     docker compose restart api

11) Entrega
   - URL API final: https://$API_DOMAIN
   - IP y dominio
   - Salida de /health y número de países
   - Estado de Docker, Caddy y UFW
   - Cualquier paso que no hayas podido completar
   - Recordatorio: en Vercel hay que definir
     NEXT_PUBLIC_API_BASE=https://$API_DOMAIN
     y redesplegar.
```

## Transferir los datos desde tu máquina

El repo no incluye `data/v2/` (779 MB) ni la base SQLite. Desde tu máquina:

```bash
cd /home/hans/Proyectos/nasa2026/ninacal
tar -I zstd -cf /tmp/ninacal-data-005.tar.zst data/v2
scp /tmp/ninacal-data-005.tar.zst root@TU_IP:/tmp/
```

Si prefieres no transferir 1.3 GB de SQLite, deja que el VPS lo genere con
`python3 backend/scripts/build_db.py` (tarda ~1 minuto y solo necesita Python 3).

## Después del VPS: Vercel

El proyecto `ninacal` ya está creado y vinculado desde `apps/web`. Cuando el VPS entregue la
URL, desde tu máquina:

```bash
cd /home/hans/Proyectos/nasa2026/ninacal/apps/web
vercel env add NEXT_PUBLIC_API_BASE production
# pega https://api.tudominio.com
vercel --prod
```

Si Vercel está conectado a GitHub, también puedes definir la variable en
**Project → Settings → Environment Variables** y hacer push a `main`.
