# Reglas de operación (API congelada)

Estado actual:

- Frontend: **https://ninacal.vercel.app**
- API: **https://5.189.178.36.sslip.io**
- VPS: `/opt/ninacal`, contenedor `ninacal-api-1`, solo `127.0.0.1:8080`
- Datos: 12 países, **0.05°**, `data/v2` (779 MB) + SQLite (1.3 GB)
- Git: `main` conectado a Vercel; los push despliegan solos
- Datos y SQLite **no están en Git** (`.gitignore`)

## Regla de oro

**La API está congelada.** No se editan `backend/src`, endpoints, contratos JSON, Dockerfile ni
`docker-compose.yml` para una actualización normal de datos. El backend ya está desplegado y
sano. Los cambios futuros son **precálculos + reemplazo de datos + reinicio**.

## Actualizar datos de los mismos 12 países (sin tocar código)

En la máquina que calcula:

```bash
cd ninacal-pipeline-v2.2
# datos nuevos en web/data/v2/
make all WORKERS=4
```

Luego, en el VPS:

```bash
cd /opt/ninacal

# backup antes de reemplazar
mkdir -p /var/backups/ninacal
tar -I zstd -cf "/var/backups/ninacal/ninacal-$(date +%F-%H%M).tar.zst" \
  data/v2 backend/data/ninacal.sqlite

# reemplazar solo el bundle (desde tu máquina)
# rsync -avP --delete data/v2/ root@5.189.178.36:/opt/ninacal/data/v2/

python3 backend/scripts/build_db.py
docker compose restart api
sleep 3
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/api/countries | head -c 300
```

No hace falta rebuild de Docker ni redeploy de Vercel para los mismos países: el frontend lee
la API. La imagen no contiene datos.

## Agregar países nuevos

El pipeline puede registrar más países, pero el catálogo visual del frontend es explícito:

1. Calcular y exportar el país (mismos pasos de pipeline).
2. Copiar `web/data/v2/` al VPS y regenerar SQLite.
3. Reiniciar `api`.
4. **Único cambio de frontend:** añadir el país a `apps/web/lib/countries.ts`
   (`code`, `name`, `iso3`, `viewBbox`, `boundary`) y hacer push. Vercel redespliega solo.
5. No se toca la API ni el contrato.

Si se quiere que esto sea 100 % automático, el siguiente paso sería generar ese catálogo desde
`/api/countries` en build; mientras tanto, es un archivo de configuración, no una API.

## Descarga del mundo

- `make add-world` registra países y descarga los CSV; **no calcula**.
- Se puede detener en cualquier momento: los archivos completos quedan; al reanudar se saltan.
- Los `.part.*` incompletos no se usan; se pueden borrar:
  `find data/raw -name '*.part.*' -delete`.
- Reanudar:

```bash
cd ninacal-pipeline-v2.2
. .venv/bin/activate
make download          # usa countries.json y salta lo existente
# o: make add-world
```

- `make all` procesa solo países con los 48 archivos completos (`with_raw_data()`); los
  países a medias se ignoran. Se puede calcular con lo que ya está completo.
- Mundo completo: ~33 GB de descarga, ~60–65 GB en disco total, ~3–5 h de cómputo en esta
  máquina; deployable web+SQLite ~9–10 GB.
- 2026 no está disponible en los archivos anuales de FIRMS (404 al 2026-11-15). El bundle
  termina en 2025, el último año completo.

## Qué no se toca

- No subir `data/v2/` ni `backend/data/ninacal.sqlite` a Git.
- No abrir el puerto 8080 en el VPS; Nginx/Caddy publica 443.
- No cambiar `NEXT_PUBLIC_API_BASE` salvo cambio de dominio.
- No tocar el contenedor FILAM del VPS.
- No meter datos en el build de Vercel: debe seguir siendo ~8 MB sin `/data`.

## Cambio de dominio

1. DNS del dominio → `5.189.178.36`.
2. Reemitir certificado en Nginx/certbot (o Caddy).
3. En Vercel: `NEXT_PUBLIC_API_BASE=https://nuevo-dominio`.
4. Redeploy del frontend.
5. Probar `/health`, `/api/countries`, `/data/boundaries/...` y CORS.

## Verificación mínima después de cada cambio de datos

```bash
curl -fsS https://5.189.178.36.sslip.io/health
curl -fsS https://5.189.178.36.sslip.io/api/countries | head -c 300
curl -fsS "https://5.189.178.36.sslip.io/api/region?country=PE&start=2025&end=2025" | head -c 300
curl -sI "https://5.189.178.36.sslip.io/api/region?country=BR&start=2025&end=2025" \
  | grep -i access-control-allow-origin
```

Y en el frontend: `/console/`, país Brasil, Acre, CSV y `docs/NASA-COMPLIANCE.md`.
