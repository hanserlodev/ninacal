> **Historical.** Superseded by the 153-country release (`deploy/VPS-UPDATE-153.md`). Kept for reference.

# Cutover to the 78-country bundle

The pipeline export for 78 countries at 0.05° is validated (`make export report test verify`
prints `VERIFIED` for every country and ends with `OK`). The live API still serves the
12-country bundle. Do the cutover in this order so the frontend never lists countries the
API cannot answer for.

## 0. What was validated

| Item | Value |
|---|---|
| Countries | 78 |
| Years | 2003–2025 (276 months) |
| Grid | 0.05° |
| Cells | 1,825,370 |
| Cell-month rows | 36,355,684 |
| Web bundle (full) | 1.9 GB |
| SQLite | 3.4 GB |

## 1. Boundaries for all 78 countries

`apps/web/lib/countries.generated.json` only includes countries whose ADM1 boundary exists in
`data/v2/boundaries/`. The repo currently ships 12 files. Add the remaining ADM1 simplified
GeoJSON files (geoBoundaries ADM1, same naming as the existing ones) before regenerating the
catalogue. `scripts/generate_countries.py` prints `SKIP <code>` for any missing boundary
instead of emitting a broken entry.

## 2. Stage the bundle locally

```bash
cd /home/hans/Proyectos/nasa2026/ninacal
# Full JSON bundle (needed by build_db.py). Git ignores data/v2 except README.
# Keep data/v2/boundaries: the pipeline export does not produce it.
rsync -a --exclude boundaries --delete \
  ../pipeline-work/ninacal-pipeline-v2.2/web/data/v2/ data/v2/
```

## 3. Rebuild SQLite

```bash
python3 backend/scripts/build_db.py
# -> backend/data/ninacal.sqlite (~3.4 GB, ~6-8 min)
```

## 4. Regenerate the frontend catalogue (last, then deploy)

```bash
python3 scripts/generate_countries.py
npm --prefix apps/web run typecheck
```

The catalogue is what the home page count, the country picker and the comparison selectors
read, so regenerate it only when the VPS already has the data (or deploy both together).

## 5. Package only what the API needs

```bash
chmod +x deploy/package-data.sh
./deploy/package-data.sh
# stages manifest + series/uncertainty/calibration/models + boundaries + SQLite
# ~3.8 GB instead of 5.3 GB
```

`package-data.sh` deliberately skips `years/*.json` and `cells.json`: those drive the static
provider, while the API answers grids from SQLite.

## 6. Transfer and restart

```bash
rsync -avP --info=progress2 /tmp/ninacal-78-payload/ root@5.189.178.36:/opt/ninacal/
ssh root@5.189.178.36 'cd /opt/ninacal && docker compose restart api && sleep 3 && curl -fsS http://127.0.0.1:8080/health'
```

Verify:

```bash
curl -fsS https://5.189.178.36.sslip.io/api/countries | head -c 300
curl -fsS 'https://5.189.178.36.sslip.io/api/grid/DE?year=2024' | head -c 200
```

## 7. Publish the frontend

```bash
git add apps/web/lib/countries.generated.json
git commit -m "data: publish 78-country catalogue"
git push origin main   # Vercel auto-deploys
```

Then hard-refresh once (or clear IndexedDB) because the JSON cache keeps the 12-country
manifest for up to 12 h.

## Rollback

Keep the previous `data/v2` and `backend/data/ninacal.sqlite` on the VPS until verification
passes:

```bash
cd /opt/ninacal
mv data/v2 data/v2.12
mv backend/data/ninacal.sqlite backend/data/ninacal.12.sqlite
# restore the previous copies, then:
docker compose restart api
```
