# Correr el pipeline en Google Cloud (crédito $300/90 días)

La VM no sirve tráfico: sirve para calcular. El VPS sigue siendo la API y Vercel el
frontend. Con `e2-standard-16` el pipeline de 78 países tarda minutos en vez de una hora;
para 158 países es la forma práctica de hacerlo.

## 1. Empaquetar el pipeline

Solo para recalcular modelos/export (lo normal):

```bash
cd /home/hans/Proyectos/nasa2026
tar -C pipeline-work/ninacal-pipeline-v2.2 \
    --exclude='data/derived/v2/cache' \
    --exclude='data/raw' \
    -cf - . | zstd -19 -T0 -o ninacal-pipeline.tar.zst
```

Para añadir países nuevos (`make prepare`) incluye también `data/raw` y `cache/`; el tar
puede pasar de 50 GB y la subida será el cuello de botella.

## 2. Subir a GCS

```bash
gcloud storage buckets create gs://TU_BUCKET --location=us-central1
gcloud storage cp ninacal-pipeline.tar.zst gs://TU_BUCKET/
gcloud storage objects update gs://TU_BUCKET/ninacal-pipeline.tar.zst \
    --add-acl-grant=entity=AllUsers,role=READER
```

La URL pública queda:
`https://storage.googleapis.com/TU_BUCKET/ninacal-pipeline.tar.zst`

## 3. Crear la VM

```bash
PROJECT=tu-proyecto \
BUCKET=TU_BUCKET \
PIPELINE_TAR_URL=https://storage.googleapis.com/TU_BUCKET/ninacal-pipeline.tar.zst \
./deploy/gcp/create-vm.sh
```

La VM instala Python 3.12 con `uv`, ejecuta
`make models export report test verify`, sube `web/data/v2` y `ninacal.sqlite` a
`gs://TU_BUCKET/releases/<timestamp>/` y se apaga sola.

## 4. Seguir y recoger

```bash
gcloud compute ssh ninacal-pipeline --zone us-central1-a -- tail -f /var/log/ninacal-startup.log
gcloud storage cp -r 'gs://TU_BUCKET/releases/*' ./release/
```

Luego reconstruye el SQLite definitivo con `backend/scripts/build_db.py` y empaqueta con
`deploy/package-data.sh`.

## 5. Coste y limpieza

`e2-standard-16` + 250 GB SSD cuesta unos **$0,60/hora**; una corrida de 2–4 h son
$1,5–2,5 del crédito de $300. La VM se apaga al terminar; bórrala cuando tengas los datos:

```bash
gcloud compute instances delete ninacal-pipeline --zone us-central1-a
```

## Notas

- El script no incluye credenciales: usa la service account de la VM con scope `storage-rw`.
- Si el pipeline cambia, vuelve a subir el tar; la VM siempre parte de cero.
- No uses esta VM como API: SQLite y el tráfico web no son su caso de uso.
