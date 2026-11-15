# Planetary Computer context (land cover + burned area)

`scripts/planetary_context.py` summarizes two public Microsoft Planetary Computer
collections for a bounding box:

- **Land cover**: `io-lulc-annual-v02` (10 m, annual from 2017). Share of water, trees,
  flooded vegetation, crops, built area, bare ground, snow/ice, clouds and rangeland.
- **Burned area**: `modis-64A1-061` (MCD64A1, 500 m monthly burn date). Burned pixels are
  converted to km² using the dataset pixel size.

No account or token is needed. This is **context**, not a replacement for NinaCal's
harmonized hotspot-day product: a thermal detection is not a confirmed fire and MODIS burned
area has its own commission/omission errors.

## Install and run

```bash
pip install -r scripts/requirements-planetary.txt
python3 scripts/planetary_context.py \
  --bbox -73.88,-11.12,-66.62,-7.32 --year 2023 --output acre-2023.json
```

Example (Acre, 2023):

```json
{
  "landcover": {
    "collection": "io-lulc-annual-v02",
    "year": 2023,
    "classes": {
      "trees": 0.929,
      "rangeland": 0.062,
      "water": 0.005,
      "crops": 0.0016,
      "built_area": 0.0016
    }
  },
  "burned_area": { "year": 2023, "burned_pixels": 1335, "area_km2": 335.476 }
}
```

## Caveats

- Land-cover shares are sampled with a pixel cap per tile (default 512×512) and nearest
  resampling; they are proportions, not exact class areas.
- Burned area sums monthly MCD64A1 tiles; a pixel that burns twice in a year or sits on a
  tile edge can be counted twice. Use it as an order-of-magnitude comparison.
- The script performs network reads; it is a precompute/analysis tool, not a request-time
  endpoint. To show it in the app, cache the JSON per country/year in the bundle.
