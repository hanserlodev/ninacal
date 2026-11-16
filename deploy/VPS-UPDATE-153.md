# Actualizar el VPS al bundle de 153 países

Payload: `ninacal-153-payload.tar.zst` — **1,17 GB comprimido** (5,56 GB extraído).
No cambia el código de la API: solo datos + SQLite. El catálogo del frontend se actualiza
después, en Vercel.

## 0. Disco (importante)

```bash
df -h /opt
du -sh /opt/ninacal/data/v2* /opt/ninacal/backend/data/*.sqlite* 2>/dev/null
```

Necesitas **~12 GB libres**. El script mueve los datos actuales a `*.bak-<fecha>`, extrae
5,56 GB y guarda el tar. Si no hay espacio, borra backups viejos **solo después** de confirmar
que la release R2 actual funciona.

## 1. Subir

```bash
cd /home/hans/Proyectos/nasa2026
scp ninacal-153-payload.tar.zst ninacal-153-payload.tar.zst.sha256 \
    root@5.189.178.36:/tmp/
```

Checksum: `bcc1200e481cb7edb475a14ed0d5e3de23df62c00d2fe455324068bfa8af8f02`

## 2. Aplicar

```bash
cd /opt/ninacal && git pull
cd /tmp && sha256sum -c ninacal-153-payload.tar.zst.sha256
sudo EXPECTED_COUNTRIES=153 bash /opt/ninacal/deploy/vps-apply-78.sh \
    /tmp/ninacal-153-payload.tar.zst
```

El script hace backup, extrae, reinicia `api`, espera health, verifica 153 países y hace
rollback automático si algo falla.

## 3. Verificar

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/api/countries | python3 -c "import json,sys;print(len(json.load(sys.stdin)))"
curl -fsS 'http://127.0.0.1:8080/api/grid/IL?year=2024' | head -c 160
curl -fsS 'http://127.0.0.1:8080/api/grid/LU?year=2024' | head -c 160
curl -fsS 'http://127.0.0.1:8080/api/series/IL' | head -c 160
curl -fsS 'http://127.0.0.1:8080/data/IL/models.json' | python3 -c \
  "import json,sys;d=json.load(sys.stdin);print(d['chosen'],d['temporal_cv_selected_model']['country'])"
docker exec ninacal-api-1 id
docker compose ps
```

Esperado: 153 países; IL elige `ratio_cell_k10`, CV WAPE ~51,6 %, bias ~-0,1 %; grids 200;
uid 65532; api healthy.

## 4. Frontend

El catálogo está generado con 153 en el repo, pero **no se ha pusheado** para no mostrar 153
mientras la API servía 78 (ya aplicado: la API sirve 153). Para futuras releases:

```bash
cd /home/hans/Proyectos/nasa2026/ninacal
git add apps/web/lib/countries.generated.json
git commit -m "data: publish 153-country catalogue"
git push origin main
```

Vercel despliega solo. El selector es dinámico (`/api/countries`), así que la consola ya
mostrará los 153 en cuanto la API los sirva, incluso antes de ese push; el push solo alinea
la portada/SEO.

## 5. Limpieza

Tras verificar, borra los backups antiguos que ya no necesites:

```bash
ls -d /opt/ninacal/data/v2.bak-* /opt/ninacal/backend/data/ninacal.sqlite.bak-*
```

No borres el backup de la release que estés usando hasta tener la siguiente validada.
