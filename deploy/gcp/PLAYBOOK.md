# Google Cloud: qué sacar provecho para NinaCal y para ti

El crédito de $300 dura 90 días. No es hosting permanente: úsalo para **cómputo caro**,
**almacenamiento versionado** y **analítica**, y apaga lo que no uses.

## Para el proyecto

### 1. Pipeline mundial en una VM temporal (el uso principal)

Hoy los 158 países se calculan en tu máquina durante horas. Una `e2-standard-16` con 250 GB
SSD termina en mucho menos y cuesta ~$0,70/h; una corrida de 2–4 h son $1,5–3 del crédito.

```bash
PROJECT=tu-proyecto BUCKET=ninacal-releases \
PIPELINE_TAR_URL=https://storage.googleapis.com/ninacal-releases/ninacal-pipeline.tar.zst \
./deploy/gcp/create-vm.sh
```

La VM se apaga sola al terminar y sube `web/data/v2` + `ninacal.sqlite` a
`gs://BUCKET/releases/<fecha>/`. Luego reconstruyes el SQLite definitivo y empaquetas.

### 2. Releases en Cloud Storage (barato y versionado)

- Guarda cada release (`web/data/v2` + SQLite) en `gs://ninacal-releases/releases/<fecha>/`.
- Lifecycle: borrar versiones >90 días.
- Coste: ~$0,02/GB-mes; 5 GB son céntimos. La salida a internet (~$0,12/GB) para bajar 764 MB
  son ~$0,09.
- Ventaja: el VPS descarga la release con `gcloud storage cp` en vez de que tú subas 764 MB
  desde casa.

### 3. BigQuery para analítica y para el jurado

Exporta `activity` a Parquet por país/año y cárgalo en BigQuery (sandbox: 1 TB de consultas
gratis al mes). Tres consultas que puedes enseñar:

```sql
-- Top países por hotspot-days en 2024
SELECT country, ROUND(SUM(harm), 0) AS hotspot_days
FROM ninacal.activity
WHERE year = 2024
GROUP BY country
ORDER BY hotspot_days DESC
LIMIT 10;

-- Meses por encima de la mediana histórica del país
WITH monthly AS (
  SELECT country, year, month, SUM(harm) AS value
  FROM ninacal.activity
  WHERE year BETWEEN 2003 AND 2025
  GROUP BY country, year, month
), medians AS (
  SELECT country, month, APPROX_QUANTILES(value, 2)[OFFSET(1)] AS median
  FROM monthly GROUP BY country, month
)
SELECT m.country, m.year, m.month, ROUND(m.value, 0) AS value, ROUND(d.median, 0) AS median
FROM monthly m JOIN medians d USING (country, month)
WHERE m.year = 2025 AND m.value > 2 * d.median
ORDER BY m.value DESC
LIMIT 20;

-- Mezcla de fuentes por año
SELECT year, source, COUNT(*) AS months
FROM ninacal.availability
GROUP BY year, source
ORDER BY year, source;
```

Con eso puedes añadir un enlace “Query this archive in BigQuery” al README o al pitch.

### 4. Cloud Run como espejo de emergencia (no como API principal)

No metas el SQLite de 3,3 GB en Cloud Run. Para el día de la demo, hornea una **versión
reducida** (12 países o 0,1°) en la imagen, despliega con `max-instances=1` y úsala solo si el
VPS falla. El free tier de Cloud Run cubre de sobra una demo.

### 5. Cloud Run Jobs + Scheduler (opcional)

Un job mensual que descargue FIRMS, ejecute `prepare/models/export` y suba la release a GCS.
Es más caro que una VM puntual; úsalo solo si automatizas el archivo.

## Para ti

- **Portfolio real**: arquitectura GCP (GCS + VM batch + BigQuery + Cloud Run), tabla de
  costes y decisiones. Es una historia mucho más fuerte que “subí una web”.
- **Certificación**: Cloud Digital Leader → Associate Cloud Engineer. El crédito y los labs
  te sirven para practicar.
- **Free tier permanente**: `e2-micro` en us-central1, Cloud Run con scale-to-zero, GCS 5 GB,
  BigQuery 1 TB de consultas/mes. Sirve para futuros proyectos pequeños.
- **Práctica de costos**: budgets, labels, lifecycle, apagar VMs. Es la habilidad que más
  valoran en cloud.

## Guardrails (hazlo el primer día)

```bash
gcloud projects create ninacal-prod
gcloud config set project ninacal-prod
gcloud services enable compute.googleapis.com storage.googleapis.com \
    run.googleapis.com bigquery.googleapis.com

# Alerta de presupuesto (ajusta la cuenta de facturación)
gcloud billing budgets create \
  --billing-account=TU_BILLING_ACCOUNT \
  --display-name="NinaCal 20 USD" \
  --budget-amount=20USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9
```

- Etiqueta todo con `project=ninacal`.
- Borra la VM al terminar: `gcloud compute instances delete ninacal-pipeline --zone us-central1-a`.
- No dejes una `e2-standard-16` encendida: a ~$0,70/h son ~$500/mes.
- El crédito no cubre todos los servicios en todas las regiones; revisa la calculadora.

## Qué NO hacer

- Migrar la API completa (SQLite 3,3 GB) a Cloud Run/Functions: I/O aleatorio y cold starts.
- Usar el crédito como hosting “gratis” permanente: a los 90 días se acaba.
- Guardar credenciales en el repo o en variables `NEXT_PUBLIC_*`.
- Dejar discos o IPs estáticas olvidadas: se cobran aunque la VM esté apagada.
