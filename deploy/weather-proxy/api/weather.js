// Vercel serverless proxy for Meteomatics.
// Keeps the credentials server-side, caches for one hour and restricts CORS.
//
// Env: METEO_USER, METEO_PASS, ALLOWED_ORIGIN (comma-separated list)

const PARAMS = [
  "t_max_2m_24h:C",
  "t_min_2m_24h:C",
  "relative_humidity_2m:p",
  "wind_speed_10m:kmh",
  "precip_24h:mm",
].join(",");

export default async function handler(request, response) {
  const env = process.env;
  // Public, read-only weather data: a wildcard keeps the edge cache correct.
  response.setHeader("Access-Control-Allow-Origin", "*");
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return response.status(204).end();
  }
  if (request.method !== "GET") {
    return response.status(405).json({ error: "method not allowed" });
  }

  const lat = Number(request.query.lat);
  const lon = Number(request.query.lon);
  const date = String(request.query.date || "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return response.status(400).json({ error: "lat/lon must be WGS84 numbers" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return response.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  if (!env.METEO_USER || !env.METEO_PASS) {
    return response.status(503).json({ error: "weather service not configured" });
  }

  const upstream =
    `https://api.meteomatics.com/${date}T00:00:00Z--${date}T23:59:59Z:PT24H/` +
    `${PARAMS}/${lat},${lon}/json`;
  const auth = Buffer.from(`${env.METEO_USER}:${env.METEO_PASS}`).toString("base64");

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstream, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
  } catch {
    return response.status(502).json({ error: "weather upstream unreachable" });
  }
  if (!upstreamResponse.ok) {
    return response.status(502).json({ error: `weather upstream ${upstreamResponse.status}` });
  }

  let payload;
  try {
    payload = await upstreamResponse.json();
  } catch {
    return response.status(502).json({ error: "weather upstream returned invalid JSON" });
  }

  const values = {};
  for (const series of payload.data ?? []) {
    values[series.parameter] = series.coordinates?.[0]?.dates?.[0]?.value ?? null;
  }

  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return response.status(200).json({
    date,
    lat,
    lon,
    tMaxC: values["t_max_2m_24h:C"] ?? null,
    tMinC: values["t_min_2m_24h:C"] ?? null,
    humidityPct: values["relative_humidity_2m:p"] ?? null,
    windKmh: values["wind_speed_10m:kmh"] ?? null,
    precipMm: values["precip_24h:mm"] ?? null,
    source: "Meteomatics",
  });
}
