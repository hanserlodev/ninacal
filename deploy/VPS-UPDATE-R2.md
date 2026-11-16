# Actualización R2 — datos corregidos + API endurecida

Bundle validado: 78 países, disponibilidad derivada del dato (`2024-05/09/10/11` observados),
`CHN-ADMIN` consistente, SQLite atómico y verificado.

## 1. En tu máquina

```bash
cd /home/hans/Proyectos/nasa2026

scp ninacal-78-payload-r2.tar.zst ninacal-78-payload-r2.tar.zst.sha256 \
    root@5.189.178.36:/tmp/
scp ninacal/deploy/vps-apply-78.sh \
    root@5.189.178.36:/tmp/
```

Checksum: `4d381ecae5eda911c475fab31b792eee658562d4c420afe7e53ea6906275dc2c`
Tamaño: 764 MB (3,50 GB sin comprimir).

Si se corta, reanuda con `rsync -avP`.

## 2. Prompt para el agente del VPS

```text
Actualiza NinaCal a la release R2 (datos corregidos + API endurecida).
Archivos ya en /tmp:
- /tmp/ninacal-78-payload-r2.tar.zst
- /tmp/ninacal-78-payload-r2.tar.zst.sha256
- /tmp/vps-apply-78.sh

Pasos, en este orden:
1) cd /opt/ninacal && git pull
2) docker compose build api
3) docker compose up -d --force-recreate api
4) sha256sum -c /tmp/ninacal-78-payload-r2.tar.zst.sha256
5) sudo bash /opt/ninacal/deploy/vps-apply-78.sh /tmp/ninacal-78-payload-r2.tar.zst

No borres los backups *.bak-<fecha>. Si el script falla, muestra la salida completa y no
lo arregles a mano.

Verifica y entrega:
  curl -fsS http://127.0.0.1:8080/health
  curl -fsS 'http://127.0.0.1:8080/api/series/BR/BR?level=months' | python3 -c "import json,sys; d=json.load(sys.stdin); print([(r['month'],r['source']) for r in d['rows'] if r['year']==2024 and r['month'] in (5,7,9,10)])"
  curl -fsS 'http://127.0.0.1:8080/api/series/CHN' | python3 -c "import json,sys; d=json.load(sys.stdin); ids=[x['id'] for x in d]; print(len(ids), 'CHN-ADMIN' in ids)"
  curl -s -o /dev/null -w 'grid CHN %{http_code}\n' 'http://127.0.0.1:8080/api/grid/CHN?year=2024'
  curl -s -o /dev/null -w 'cells BR %{http_code}\n' 'http://127.0.0.1:8080/api/region?country=BR&format=cells'
  docker exec ninacal-api-1 id
  docker compose ps
  du -sh data/v2 backend/data/ninacal.sqlite

Esperado: health ok, BR 2024-05/09/10 = snpp_observed (07 = noaa20_estimated), 34 series
con CHN-ADMIN, grid CHN 200, cells BR 400, uid=65532, api healthy.
```

## 3. Nginx (opcional, después de verificar la API)

`deploy/nginx-cache.conf` mezcla directivas de `http{}` y de `server{}`. Aplícalo con cuidado:

- `proxy_cache_path`, `limit_req_zone`, `limit_conn_zone` y `map` van en
  `/etc/nginx/conf.d/ninacal-cache.conf` (nivel http).
- Los `location` y el HSTS van dentro del server de `5.189.178.36.sslip.io`.
- `nginx -t` y `systemctl reload nginx`.

Si algo falla, retira el archivo de `conf.d` y recarga. La API ya está protegida por payload,
puntos de polígono, CSV y hilos; Nginx añade cache de borde y rate limit.

## 4. Rollback

El script restaura solo si falla. Manual:

```bash
cd /opt/ninacal
rm -rf data/v2 && mv data/v2.bak-<fecha> data/v2
rm -f backend/data/ninacal.sqlite && mv backend/data/ninacal.sqlite.bak-<fecha> backend/data/ninacal.sqlite
docker compose restart api
```

## 5. Frontend

El catálogo no cambia. La caché del navegador se versionó a `bundle-78-r2`; tras el despliegue
del VPS, un **Ctrl+F5** una vez garantiza los valores nuevos (o esperar 12 h al TTL).
