# Submission checklist

What "done" means for NASA Space Apps 2026. Owners: **H** = Hans, **D** = Data, **P** = Pitch.

## Product

- [ ] Region selectable (draw a polygon or enter a bounding box) + date range — **H**
- [ ] Calendar year × month, 2000 → today, with an accessible color ramp (viridis/cividis) — **H**
- [ ] Current month vs historical median + standardized anomaly — **H/D**
- [ ] MODIS ↔ VIIRS validation chart (observed vs predicted, held-out years) — **H/D**
- [ ] CSV download works for the current selection — **H**
- [ ] UI warning: hotspot ≠ confirmed fire — **H**
- [ ] Data limitations visible in the interface — **H/P**

## Data

- [ ] `data/processed/{year}.json` for every year in the declared range — **D**
- [ ] `data/processed/calibration.json` with method, factors and test metrics — **D**
- [ ] No `0` used for missing values; schema validation passes — **D**
- [ ] Data dictionary matches the files actually committed — **D**
- [ ] Years available and grid coverage stated in [limitations](limitations.md) — **D/P**

## Delivery

- [ ] App deployed and tested on a phone — **H**
- [ ] Public repo with README, methodology and limitations — **H/P**
- [ ] Project text uploaded to the platform — **P**
- [ ] 30-second English video uploaded — **P**
- [ ] Submitted before the official deadline — **H**

## Freeze rule

Features freeze Sunday at 11:00. After that: bugs, copy and data fixes only. Nothing that
touches the data contract ships after the freeze without both H and D.
