# Roadmap

A living plan, not a promise. Times below are the hackathon weekend (all local time); dates
are real deadlines, features are negotiable.

## Hackathon weekend

### Saturday

| Time           | Goal                                                              | Owner       |
| -------------- | ----------------------------------------------------------------- | ----------- |
| Before 10:25   | Repo, structure, data contract, mock, README                      | Hans        |
| 10:25 – 12:00  | Aggregation script, Next.js shell, MapLibre + region selection, problem statement | Data, Hans, Pitch |
| 12:00 – 13:30  | Pipeline running on whatever CSVs arrived; methodology draft      | Data, Pitch |
| 13:30 – 15:15  | Calendar heatmap on mock data, region filtering                   | Hans        |
| 15:15 – 16:15  | First visible version: map + region + calendar                    | Hans, Data  |
| 16:15          | Demo to mentors                                                   | Pitch       |
| Evening        | Finish calibration and validation; connect real data              | Data, Hans  |

### Sunday

| Time            | Goal                                                                 | Owner        |
| --------------- | -------------------------------------------------------------------- | ------------ |
| 09:30 – 11:00   | Current month vs median, anomaly, CSV, validation chart, deployment   | Hans, Data, Pitch |
| **11:00**       | **Feature freeze** — bugs only from here                             | Everyone     |
| 11:30 – 13:00   | English script and rehearsal                                         | Pitch        |
| 14:00 – 15:30   | Record the 30-second video                                           | Pitch        |
| **Before 15:30**| **Submit** on the official platform (limit is 23:59; do not wait)    | Hans         |

## Scope rule

If something will not make it on time, **cut scope, not quality**: fewer years or a smaller
region with everything working beats a wider promise that does not load. Never claim
coverage or accuracy that the pipeline has not produced.

## After the hackathon

Only if the project continues:

- [ ] Publish the validation report as a standalone page.
- [ ] Add a second study region and document grid alignment.
- [ ] Move data fetching to HTTP range requests over a single Parquet file if JSON payloads
      grow.
- [ ] Add automated accessibility checks (axe) to CI.
- [ ] Write a short "how to reproduce the paper" guide for the pipeline.

Ideas that are explicitly **not** planned: live alerting, fire spread modeling, accounts,
server-side anything.
