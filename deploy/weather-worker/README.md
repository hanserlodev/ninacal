# NinaCal weather Worker

Proxy de una consulta diaria a Meteomatics para que el frontend estático nunca
vea las credenciales. Cachea 1 hora en el edge y limita CORS al origen configurado.

## Desplegar

```bash
cd deploy/weather-worker
npm install -g wrangler
wrangler login
wrangler secret put METEO_USER
wrangler secret put METEO_PASS
wrangler deploy
```

Wrangler imprime la URL `https://ninacal-weather.<subdominio>.workers.dev`.

## Probar

```bash
curl 'https://ninacal-weather.<subdominio>.workers.dev/weather?lat=-9.5&lon=-75&date=2024-09-15'
```

Respuesta:

```json
{
  "date": "2024-09-15",
  "lat": -9.5,
  "lon": -75,
  "tMaxC": 31.2,
  "tMinC": 21.4,
  "humidityPct": 78,
  "windKmh": 12.5,
  "precipMm": 3.1,
  "source": "Meteomatics"
}
```

## Límites

- 1.000 consultas/día del offer. El Worker cachea por lat/lon/date, así que un
  panel que repita la misma fecha no consume cuota.
- CORS: cambia `ALLOWED_ORIGIN` en `wrangler.toml` si usas un dominio propio.
- No metas `METEO_USER`/`METEO_PASS` en el repo ni en el frontend.
