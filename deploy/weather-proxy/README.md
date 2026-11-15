# NinaCal weather proxy (Vercel)

Proxy serverless para Meteomatics. Mantiene las credenciales en el servidor, limita CORS
y cachea una hora en el edge de Vercel.

## Desplegar

```bash
cd deploy/weather-proxy
vercel link --yes --project ninacal-weather
printf '%s' "$METEO_USER" | vercel env add METEO_USER production
printf '%s' "$METEO_PASS" | vercel env add METEO_PASS production
printf '%s' "https://ninacal.earth,https://www.ninacal.earth,https://ninacal.vercel.app" \
  | vercel env add ALLOWED_ORIGIN production
vercel --prod --yes
```

La URL queda `https://ninacal-weather.vercel.app/api/weather` (ya desplegada y en uso por
`ninacal.earth`).

## Probar

```bash
curl 'https://ninacal-weather.vercel.app/api/weather?lat=-9.5&lon=-75&date=2024-09-15'
```

## Límites

- 1.000 consultas/día del offer; el edge cachea por lat/lon/fecha.
- No pongas las credenciales en el frontend.
