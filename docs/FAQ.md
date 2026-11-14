# FAQ

## What is NinaCal?

A static web app that shows a year × month calendar of fire detections for a region you
choose, built from a harmonized MODIS + VIIRS series that spans 2000 to today.

## Why do MODIS and VIIRS need "harmonizing"?

They are different instruments with different pixel sizes, overpass times and detection
thresholds. Concatenating them produces fake trends around 2012; calibrating VIIRS to
MODIS-equivalent counts on the years both exist makes the series comparable. Details in
[methodology](methodology.md).

## Is this a fire map or an alert system?

No. It is a historical activity calendar built from satellite thermal anomalies. It has no
live alerts, no incident confirmation and no risk score. See [limitations](limitations.md).

## Which regions are covered?

Whatever the committed dataset covers — initially **Peru** at 0.1° resolution. You can draw
any region, but outside the processed grid the app honestly returns nothing.

## Why 0.1° cells and monthly counts?

Because shipping individual detections for 25 years would be enormous, and the questions the
calendar answers ("which months burn most", "is this month unusual") only need aggregated
counts. Individual hotspots remain available from NASA FIRMS.

## Where does the CSV come from?

It is generated in the browser from the current selection: harmonized counts per cell and
month. No server round-trip, no personal data.

## Why is there no backend?

The data is small after aggregation and changes when the team updates it, not per request.
A static app is cheaper, faster and impossible to take down during a demo. See
[ADR 0001](decisions/0001-static-next-export.md).

## Can I reuse the code or the data?

Code: yes, MIT. Data: NASA FIRMS is openly available under NASA's data policy — cite FIRMS
and the product you use.

## How do I run it?

`cd apps/web && npm install && npm run dev`. The app reads the sample file until processed
data exists. See the [README](../README.md).

## How do I report a bug or a data problem?

Bugs and data issues have separate issue templates. A data issue should include the cell,
year, month and what looks wrong, so it can be traced in the pipeline.
