# Prompt para el OpenCode del VPS — actualizar a 78 países

Copia este bloque en el OpenCode que corre dentro del VPS. Sustituye `PAYLOAD` por la ruta
real del archivo o carpeta que subió el usuario.

```text
Actúa como OpenCode en el VPS de NinaCal. Vas a reemplazar los datos de la API por el bundle
validado de 78 países a 0.05°. No recompiles la imagen, no toques Git, no imprimas secretos y
no borres nada sin backup.

Contexto:
- APP_DIR=/opt/ninacal
- Servicio Docker: api (contenedor ninacal-api-1), puerto 127.0.0.1:8080
- Nginx publica https://5.189.178.36.sslip.io
- Datos actuales: 12 países. Bundle nuevo: 78 países, SQLite ~3.4 GB.
- PAYLOAD=<ruta del directorio o tar con data/v2 y backend/data/ninacal.sqlite>

Pasos:
1) Comprueba espacio: `df -h /opt` debe tener al menos 8 GB libres. Si no, detente y avisa.
2) Verifica el payload:
   - PAYLOAD/data/v2/manifest.json existe y tiene 78 países.
   - PAYLOAD/backend/data/ninacal.sqlite existe y pesa > 3 GB.
3) Backup (no borrar):
   cd /opt/ninacal
   mv data/v2 data/v2.12
   mv backend/data/ninacal.sqlite backend/data/ninacal.12.sqlite
4) Copia el payload nuevo:
   - Si es un directorio: `rsync -a PAYLOAD/ /opt/ninacal/`
   - Si es un tar: `tar -xf PAYLOAD -C /opt/ninacal`
   Debe quedar: /opt/ninacal/data/v2/manifest.json y /opt/ninacal/backend/data/ninacal.sqlite
5) Permisos: `chown -R root:root /opt/ninacal/data/v2 /opt/ninacal/backend/data/ninacal.sqlite`
6) Reinicia solo la API: `cd /opt/ninacal && docker compose restart api`
7) Espera 5 s y verifica:
   - `curl -fsS http://127.0.0.1:8080/health`
   - `curl -fsS http://127.0.0.1:8080/api/countries | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"` -> 78
   - `curl -fsS 'http://127.0.0.1:8080/api/grid/DE?year=2024' | head -c 200`
   - `curl -fsS 'http://127.0.0.1:8080/api/series/BR?level=years' | head -c 200`
   - `cd /opt/ninacal && docker compose ps` -> api healthy
8) Si algo falla, rollback:
   cd /opt/ninacal
   rm -rf data/v2 && mv data/v2.12 data/v2
   rm -f backend/data/ninacal.sqlite && mv backend/data/ninacal.12.sqlite backend/data/ninacal.sqlite
   docker compose restart api
9) Opcional y recomendado: aplicar `deploy/nginx-cache.conf` al server de
   5.189.178.36.sslip.io, ejecutar `nginx -t` y `systemctl reload nginx`.
10) Al terminar entrega: salida de /health, número de países, tamaño de data/v2 y del SQLite,
    y si el backup quedó en su lugar.
```
