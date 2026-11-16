# Pruebas de estrés de la API

Entorno: imagen R2 en Docker, 8 hilos, límite de 2 GB, 24 núcleos en el host de
pruebas, datos de 153 países (SQLite 5,1 GB). **No ejecutes estas cargas contra
producción sin rate limit/caché delante.**

## Línea base (una petición, curl)

| Endpoint | Tiempo | Bytes |
|---|---:|---:|
| `/health` | 0,5 ms | 30 |
| `/api/series/BR/BR?level=years` | 1,2 ms | 4,9 KB |
| `/api/region?country=PE&start=2003&end=2025` | 6,2 ms | 54 KB |
| `/api/grid/PE?year=2024` | 16 ms | 486 KB |
| `/api/grid/CHN?year=2024` | 74 ms | 2,4 MB |
| `/api/grid/BR?year=2024` | 150 ms | 4,7 MB |

## Carga ligera (curl, 20 en paralelo)

| Endpoint | Peticiones | Máximo |
|---|---:|---:|
| `/health` | 200 | **0,8 ms** |
| `/api/series/BR/BR?level=years` | 200 | **4,5 ms** |

C++ sí es rápido por petición: no hay cola ni errores en endpoints ligeros.

## Carga pesada (curl, mismo grid de Brasil)

| Concurrencia | Tiempo por petición | Errores |
|---:|---:|---:|
| 1 | 0,15 s | 0 |
| 4 | 0,95 s | 0 |
| 8 | 4,33 s | 0 |

El cuello de botella no es “C++ lento”: es el coste de escanear la tabla
`activity`, construir 4,7 MB de JSON y compartir 8 hilos. Al saturar, la latencia
sube; el proceso **no se cae ni devuelve 500**.

## Health bajo saturación

- Con 4 grids pesados y 8 hilos: el health público responde en **3,8 ms**
  (mediana) y deja 4 hilos libres.
- Con 8 grids pesados: el pool queda ocupado y el health público puede tardar
  segundos. Por eso el healthcheck de Docker usa un **puerto interno 8081** con
  un servidor ligero independiente: **80 ms** incluso con 8 grids.
- Memoria estable: 558 MB / 2 GB. Ningún OOM.

## Qué se cambió

- `--threads 8` en la imagen (antes 4).
- Servidor de liveness en `127.0.0.1:8081`; Docker lo usa para `HEALTHCHECK`.
- El `/health` público sigue comprobando SQLite; el de 8081 solo liveness.

## Qué falta para producción

1. Aplicar `deploy/nginx-cache.conf`: cache de `/api` y `/data`, `proxy_cache_lock`,
   `limit_req`/`limit_conn`, timeouts. Sin caché, cada visita pesada golpea el backend.
2. Cloudflare delante de `api.ninacal.earth` para cache de borde y rate limit.
3. Reducir payload (redondear lat/lon a 3 decimales) o añadir `/api/world` para que
   la vista mundo no haga 153 agregados.

## Reproducir

```bash
python3 scripts/stress_api.py --path /health --requests 200 --workers 20
python3 scripts/stress_api.py --path '/api/grid/BR?year=2024' --requests 8 --workers 8
```

Para microbenchmarks ligeros usa curl/xargs; `aiohttp` añade overhead de cliente.
