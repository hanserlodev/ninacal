> **Historical.** Superseded by `deploy/VPS-UPDATE-153.md`. Kept for reference.

# Actualizar el VPS a 78 países

Payload validado localmente: 78 países, 0.05°, SQLite 3.2 GB, estático 304 MB.
Comprimido: **750 MB** (`ninacal-78-payload.tar.zst`).

## 1. Subir desde tu máquina

```bash
cd /home/hans/Proyectos/nasa2026

scp ninacal-78-payload.tar.zst ninacal-78-payload.tar.zst.sha256 \
    root@5.189.178.36:/tmp/
scp ninacal/deploy/vps-apply-78.sh \
    root@5.189.178.36:/tmp/
```

Si se corta la subida, usa rsync (reanuda):

```bash
rsync -avP --info=progress2 ninacal-78-payload.tar.zst \
    root@5.189.178.36:/tmp/
```

Checksum local (debe coincidir en el VPS):

```
31b32cf14387739a95a2f60bbbcd38b82ee568b12d924a901c705fa92088acfe
```

## 2. Ejecutar en el VPS

```bash
sha256sum -c /tmp/ninacal-78-payload.tar.zst.sha256
sudo bash /tmp/vps-apply-78.sh /tmp/ninacal-78-payload.tar.zst
```

El script:

1. exige 8 GB libres y zstd/docker;
2. verifica el checksum;
3. mueve `data/v2` y `backend/data/ninacal.sqlite` a `*.bak-<fecha>`;
4. extrae el payload y ajusta permisos;
5. reinicia `api` y espera `/health`;
6. verifica 78 países, `/api/grid/DE`, `/api/grid/BR` y `/api/series/DE`;
7. si algo falla, restaura el backup y reinicia la API.

## 3. Prompt para el agente del VPS

```text
Actualiza la API NinaCal a 78 países. Los archivos ya están en /tmp:
- /tmp/ninacal-78-payload.tar.zst
- /tmp/ninacal-78-payload.tar.zst.sha256
- /tmp/vps-apply-78.sh

Ejecuta:
  sha256sum -c /tmp/ninacal-78-payload.tar.zst.sha256
  sudo bash /tmp/vps-apply-78.sh /tmp/ninacal-78-payload.tar.zst

No borres los backups *.bak-<fecha>. Si el script falla, muestra la salida completa y no
intentes arreglarlo a mano. Al terminar, entrega: salida de /health, número de países,
tamaño de data/v2 y del SQLite, y `docker compose ps`.

Opcional recomendado: aplica deploy/nginx-cache.conf al server de
5.189.178.36.sslip.io, `nginx -t` y `systemctl reload nginx`.
```

## 4. Verificación desde fuera

```bash
curl -fsS https://5.189.178.36.sslip.io/api/countries | python3 -c \
  'import json,sys; print(len(json.load(sys.stdin)))'   # 78
curl -fsS 'https://5.189.178.36.sslip.io/api/grid/DE?year=2024' | head -c 200
```

## 5. Publicar el catálogo en Vercel (después del paso 4)

El catálogo `apps/web/lib/countries.generated.json` ya está generado con 78 países, pero
no se ha subido a Git a propósito: si Vercel lo publica antes que la API, el selector
mostraría 66 países sin datos.

Cuando la API responda 78:

```bash
cd /home/hans/Proyectos/nasa2026/ninacal
git add apps/web/lib/countries.generated.json
git commit -m "data: publish 78-country catalogue"
git push origin main
```

Vercel despliega solo. La caché del navegador ya está separada por release
(`bundle-78` en `lib/cache.ts`), así que la primera carga tras el cambio descarga datos
nuevos sin hard refresh.

## Rollback

El script deja los backups y revierte solo si falla. Manual:

```bash
cd /opt/ninacal
rm -rf data/v2 && mv data/v2.bak-<fecha> data/v2
rm -f backend/data/ninacal.sqlite && mv backend/data/ninacal.sqlite.bak-<fecha> backend/data/ninacal.sqlite
docker compose restart api
```
