# Aplicar cache + rate limit de Nginx (VPS)

El VPS comparte Nginx con FILAM. **No pegues el archivo completo dentro de un
`server{}`**: mezcla directivas de `http{}` y de `server{}`. Sigue este orden.

## 0. Backup y estado

```bash
sudo cp -a /etc/nginx /root/nginx-backup-$(date +%Y%m%d-%H%M)
sudo nginx -t
sudo systemctl status nginx --no-pager | head -5
```

## 1. Nivel http

Crea `/etc/nginx/conf.d/ninacal-cache.conf` con **solo** estas directivas:

```nginx
proxy_cache_path /var/cache/nginx/ninacal levels=1:2 keys_zone=ninacal:20m
                 max_size=2g inactive=7d use_temp_path=off;

limit_req_zone  $binary_remote_addr zone=ninacal_rl:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=ninacal_conn:10m;

map $arg_format $ninacal_nocache {
    cells 1;
    default 0;
}
```

```bash
sudo mkdir -p /var/cache/nginx/ninacal
sudo chown -R www-data:www-data /var/cache/nginx/ninacal 2>/dev/null || true
sudo nginx -t
```

## 2. Nivel server (solo el de la API)

Localiza el `server{}` de `5.189.178.36.sslip.io` (no el de FILAM). Si ya tiene
`location /api/` o `/data/` de intentos anteriores, **reemplázalos** por estos.
Añade también HSTS si no está ya en ese server:

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

location = /data/manifest.json {
    proxy_pass http://127.0.0.1:8080;
    proxy_hide_header Cache-Control;
    proxy_hide_header Access-Control-Allow-Origin;
    proxy_cache_bypass 1;
    proxy_no_cache 1;
    add_header Cache-Control "no-cache" always;
    add_header Access-Control-Allow-Origin "*" always;
    add_header X-Content-Type-Options "nosniff" always;
}

location /data/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_hide_header Cache-Control;
    proxy_hide_header Access-Control-Allow-Origin;
    proxy_cache ninacal;
    proxy_cache_lock on;
    proxy_cache_valid 200 1h;
    proxy_cache_valid 404 1m;
    add_header X-Cache-Status $upstream_cache_status always;
    add_header Cache-Control "public, max-age=3600" always;
    add_header Access-Control-Allow-Origin "*" always;
    add_header X-Content-Type-Options "nosniff" always;
}

location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_hide_header Access-Control-Allow-Origin;
    proxy_hide_header Access-Control-Allow-Methods;
    proxy_hide_header Access-Control-Allow-Headers;
    proxy_hide_header Access-Control-Max-Age;
    proxy_hide_header Cache-Control;

    proxy_cache ninacal;
    proxy_cache_methods GET HEAD;
    proxy_cache_lock on;
    proxy_cache_lock_timeout 30s;
    proxy_cache_valid 200 5m;
    proxy_cache_valid 404 1m;
    proxy_no_cache     $ninacal_nocache;
    proxy_cache_bypass $ninacal_nocache;

    proxy_connect_timeout 5s;
    proxy_read_timeout 30s;
    proxy_send_timeout 30s;
    client_header_timeout 5s;
    client_body_timeout 10s;

    limit_req  zone=ninacal_rl burst=30 nodelay;
    limit_conn ninacal_conn 10;

    add_header X-Cache-Status $upstream_cache_status always;
    add_header Cache-Control "public, max-age=300" always;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type" always;
    add_header Access-Control-Max-Age "86400" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 3. Verificar

```bash
curl -sI 'https://5.189.178.36.sslip.io/api/grid/PE?year=2024' | grep -i 'x-cache-status\|access-control-allow-origin'
curl -sI 'https://5.189.178.36.sslip.io/api/grid/PE?year=2024' | grep -i 'x-cache-status'
curl -sI 'https://5.189.178.36.sslip.io/health'
curl -s 'https://5.189.178.36.sslip.io/api/countries' | head -c 80
```

- La primera petición: `MISS`; la segunda al mismo grid: **HIT**.
- Una sola cabecera `Access-Control-Allow-Origin`.
- `POST /api/region` sigue funcionando y no se cachea.
- `/health` no se cachea.
- FILAM sigue respondiendo.

## 4. Rollback

```bash
sudo rm -f /etc/nginx/conf.d/ninacal-cache.conf
sudo cp -a /root/nginx-backup-FECHA/. /etc/nginx/
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Notas

- `limit_conn 10` permite la vista mundo (8 peticiones). Si ves 503 en la primera
  carga del mundo, súbelo a 12 o baja la concurrencia del frontend.
- El cache de `/api/grid` evita que el mismo grid vuelva a C++; la primera vez
  sigue costando.
- No cachees `/api/region` POST: el mapa de `format=cells` ya lo excluye.
- Si Cloudflare está delante, su cache de borde hace el resto; mantén el `Vary`
  correcto y no dupliques HSTS.
