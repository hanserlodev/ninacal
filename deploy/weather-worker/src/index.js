// NinaCal weather context Worker (Cloudflare).
//
// Proxies one Meteomatics daily summary per lat/lon/date so the static
// frontend never sees the API credentials. Responses are cached for one hour
// at the edge and CORS is restricted to the configured origin.
//
// Secrets (wrangler secret put): METEO_USER, METEO_PASS
// Var: ALLOWED_ORIGIN (default https://ninacal.vercel.app)

const PARAMS = [
  "t_max_2m_24h:C",
  "t_min_2m_24h:C",
  "relative_humidity_2m:p",
  "wind_speed_10m:kmh",
  "precip_24h:mm",
].join(",");

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "https://ninacal.vercel.app",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, env, cacheControl = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      ...corsHeaders(env),
    },
  });
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== "/weather") {
      return json({ error: "not found" }, 404, env);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== "GET") {
      return json({ error: "method not allowed" }, 405, env);
    }

    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const date = url.searchParams.get("date") || "";
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return json({ error: "lat/lon must be WGS84 numbers" }, 400, env);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: "date must be YYYY-MM-DD" }, 400, env);
    }
    if (!env.METEO_USER || !env.METEO_PASS) {
      return json({ error: "weather service not configured" }, 503, env);
    }

    const key = new Request(
      `https://ninacal-weather.internal/weather?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&date=${date}`,
    );
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return hit;

    const upstream =
      `https://api.meteomatics.com/${date}T00:00:00Z--${date}T23:59:59Z:PT24H/` +
      `${PARAMS}/${lat},${lon}/json`;
    const auth = btoa(`${env.METEO_USER}:${env.METEO_PASS}`);

    let response;
    try {
      response = await fetch(upstream, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      });
    } catch {
      return json({ error: "weather upstream unreachable" }, 502, env);
    }
    if (!response.ok) {
      return json({ error: `weather upstream ${response.status}` }, 502, env);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      return json({ error: "weather upstream returned invalid JSON" }, 502, env);
    }

    const values = {};
    for (const series of payload.data ?? []) {
      const point = series.coordinates?.[0]?.dates?.[0]?.value;
      values[series.parameter] = number(point);
    }

    const body = {
      date,
      lat,
      lon,
      tMaxC: values["t_max_2m_24h:C"] ?? null,
      tMinC: values["t_min_2m_24h:C"] ?? null,
      humidityPct: values["relative_humidity_2m:p"] ?? null,
      windKmh: values["wind_speed_10m:kmh"] ?? null,
      precipMm: values["precip_24h:mm"] ?? null,
      source: "Meteomatics",
    };
    const result = json(body, 200, env, "public, max-age=3600");
    ctx.waitUntil(cache.put(key, result.clone()));
    return result;
  },
};
