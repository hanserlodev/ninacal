# Dominio propio + Cloudflare delante de Vercel y la API

El offer de GoDaddy/Porkbun da un dominio no premium y SSL durante un año. El hosting
incluido no sirve para Next.js ni para la API; el dominio sí.

Resultado:

```
ninacal.xxx          -> Vercel (frontend)
www.ninacal.xxx      -> Vercel
api.ninacal.xxx      -> Cloudflare (cache + rate limit) -> VPS 5.189.178.36
```

## 1. Reclamar el dominio

1. En la página del offer, pulsa **Claim Offer** y busca un dominio no premium.
2. Completa el registro en Porkbun con el launch code.
3. No uses el builder de hosting: solo necesitas el dominio.

## 2. Mover el DNS a Cloudflare

1. Crea una cuenta gratuita en Cloudflare → **Add a site** → `ninacal.xxx` (plan Free).
2. Cloudflare te da dos nameservers. Cámbialos en Porkbun (**Nameservers**).
3. Espera la propagación (minutos a unas horas).

## 3. Vercel

1. Vercel → proyecto `ninacal` → **Settings → Domains → Add**.
2. Añade `ninacal.xxx` y `www.ninacal.xxx`.
3. Vercel te dirá qué registros crear. En Cloudflare:

| Tipo | Nombre | Valor | Proxy |
|---|---|---|---|
| A | `@` | `76.76.21.21` | **DNS only** (gris) |
| CNAME | `www` | `cname.vercel-dns.com` | **DNS only** (gris) |

Deja Vercel emitiendo el certificado. No pongas el proxy naranja en el frontend para no
duplicar CDN ni romper la validación de Vercel.

## 4. API con Cloudflare

En Cloudflare → **DNS → Add record**:

| Tipo | Nombre | Valor | Proxy |
|---|---|---|---|
| A | `api` | `5.189.178.36` | **Proxied** (naranja) |

SSL/TLS → **Full (strict)**. Instala en Nginx un certificado de origen de Cloudflare
(**SSL/TLS → Origin Server → Create Certificate**) para `api.ninacal.xxx` y `ninacal.xxx`.

### Reglas de caché (Caching → Cache Rules)

1. `api.ninacal.xxx/api/grid/*` → Eligible, Edge TTL 5 min.
2. `api.ninacal.xxx/api/region*` → Eligible **solo GET**, Edge TTL 5 min; bypass POST.
3. `api.ninacal.xxx/api/series/*` y `/api/countries` → Eligible, Edge TTL 5 min.
4. `api.ninacal.xxx/data/*` → Eligible, Edge TTL 1 h.
5. `api.ninacal.xxx/data/manifest.json` → **Bypass cache**.
6. `api.ninacal.xxx/health` → Bypass.

La API ya envía `Cache-Control: public, max-age=300`; Cloudflare lo respeta si no fuerzas
otra cosa.

### Rate limit (Security → WAF → Rate limiting)

Regla para `api.ninacal.xxx/api/*`: **60 peticiones/minuto por IP**, acción *Block* 1 min.
El plan Free permite una regla; es suficiente para el hackathon.

### IP real en Nginx

Con el proxy naranja, Nginx ve IPs de Cloudflare. Añade al `http{}`:

```nginx
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 172.64.0.0/13;
real_ip_header CF-Connecting-IP;
```

(La lista completa está en `cloudflare.com/ips`.)

## 5. Apuntar el frontend a la API nueva

En Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_API_BASE = https://api.ninacal.xxx
```

Redeploy. La API ya permite CORS `*`, así que no hay que tocar el backend.

## 6. Verificar

```bash
curl -sI https://ninacal.xxx | grep -i 'server\|strict-transport'
curl -s https://api.ninacal.xxx/health
curl -sI 'https://api.ninacal.xxx/api/grid/BR?year=2024' | grep -i 'cf-cache-status\|cache-control'
```

La segunda petición al mismo grid debe traer `cf-cache-status: HIT` (o `REVALIDATED`) y
responder en decenas de milisegundos.

## Notas

- Si el dominio es `.dev`, HSTS es obligatorio y Cloudflare lo aporta.
- No pongas el proxy naranja en `@`/`www` mientras Vercel valida el dominio; después puedes
  probarlo, pero no es necesario.
- El certificado de origen de Cloudflare dura 15 años; guárdalo fuera del repo.
