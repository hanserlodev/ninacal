import { Fragment } from "react";

// TODO: replace with the real repository URL before deployment.
const REPO_URL = "https://github.com/";

const YEARS = Array.from({ length: 27 }, (_, index) => 2000 + index);
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Decorative only: a plausible September–October season with stable pseudo-noise.
 * Real values will come from data/processed/{year}.json.
 */
function intensity(year: number, month: number): number {
  const season = Math.sin(((month - 8) / 12) * Math.PI * 2);
  const noise = ((year * 37 + month * 19) % 17) / 17;
  return Math.min(1, Math.max(0.06, 0.48 + 0.36 * season + 0.14 * noise));
}

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <a className="wordmark" href="#top">
          ninacal<span aria-hidden="true">.</span>
        </a>
        <nav aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#data">Data</a>
          <a className="nav-cta" href={REPO_URL}>
            GitHub&nbsp;↗
          </a>
        </nav>
      </header>

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <p className="eyebrow">NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots</p>
          <h1 id="hero-title">
            Twenty-five years of fire,
            <br />
            <em>one calendar.</em>
          </h1>
          <p className="lede">
            MODIS and VIIRS do not agree. NinaCal harmonizes both satellite records into a
            single 2000 → today series, then turns it into a calendar you can read at a
            glance — for any region you draw.
          </p>
          <div className="actions">
            <a className="btn btn--primary" href="#data">
              See the data contract <span aria-hidden="true">→</span>
            </a>
            <a className="btn" href={`${REPO_URL}blob/main/docs/methodology.md`}>
              Read the methodology
            </a>
          </div>
          <p className="note">Open source · MIT · static, no backend · built on NASA FIRMS</p>
        </section>

        <section className="preview" aria-labelledby="preview-title">
          <div className="preview-head">
            <div>
              <p className="eyebrow">Design preview</p>
              <h2 id="preview-title">A quarter-century, in one grid</h2>
            </div>
            <p className="preview-note">
              Synthetic values for layout only. Real numbers arrive with the pipeline.
            </p>
          </div>

          <figure className="heatmap" aria-hidden="true">
            <div className="heatmap-grid">
              <span className="heatmap-corner" />
              {MONTHS.map((month, index) => (
                <span className="heatmap-month" key={`month-${index}`}>
                  {month}
                </span>
              ))}
              {YEARS.map((year) => (
                <Fragment key={year}>
                  <span className="heatmap-year">{year}</span>
                  {MONTHS.map((_, index) => (
                    <span
                      className="heatmap-cell"
                      key={`${year}-${index}`}
                      style={{
                        backgroundColor: `rgba(255, 107, 61, ${intensity(year, index + 1)})`,
                      }}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
            <figcaption className="heatmap-legend">
              <span>low activity</span>
              <span className="legend-bar" />
              <span>high activity</span>
            </figcaption>
          </figure>
        </section>

        <section className="section" id="how" aria-labelledby="how-title">
          <div className="section-head">
            <p className="eyebrow">01 — from raw detections to a readable calendar</p>
            <h2 id="how-title">How it works</h2>
          </div>
          <ol className="steps">
            <li>
              <span className="step-num">01</span>
              <h3>Aggregate</h3>
              <p>
                FIRMS CSVs from both instruments are snapped to a 0.1° grid and counted per
                cell and month. The heavy work happens offline, once.
              </p>
            </li>
            <li>
              <span className="step-num">02</span>
              <h3>Harmonize</h3>
              <p>
                VIIRS is calibrated to MODIS-equivalent counts on the 2012–2020 overlap and
                validated on years the fit never saw. The chart ships with the app.
              </p>
            </li>
            <li>
              <span className="step-num">03</span>
              <h3>Read</h3>
              <p>
                Draw a region. The browser filters cells, sums the harmonized series, draws
                the calendar and the anomaly, and exports the numbers as CSV.
              </p>
            </li>
          </ol>
        </section>

        <section className="section" aria-labelledby="features-title">
          <div className="section-head">
            <p className="eyebrow">02 — what you get</p>
            <h2 id="features-title">Built for the questions people actually ask</h2>
          </div>
          <ul className="cards">
            <li className="card">
              <h3>Which months burn most?</h3>
              <p>A year × month heatmap over the whole record, with one accessible color ramp.</p>
            </li>
            <li className="card">
              <h3>Is this month unusual?</h3>
              <p>
                The current month next to the median of the same month in previous years, plus
                a standardized anomaly.
              </p>
            </li>
            <li className="card">
              <h3>Can I trust the 2012 seam?</h3>
              <p>
                A validation chart shows observed vs predicted MODIS on held-out years, with R²
                and RMSE.
              </p>
            </li>
            <li className="card">
              <h3>Can I take the numbers?</h3>
              <p>
                Export harmonized counts per 0.1° cell and month as CSV — generated in the
                browser, no account.
              </p>
            </li>
          </ul>
        </section>

        <section className="section" id="data" aria-labelledby="data-title">
          <div className="section-head">
            <p className="eyebrow">03 — open by construction</p>
            <h2 id="data-title">One row, one cell, one month</h2>
          </div>
          <div className="data-grid">
            <div>
              <p className="lede">
                Every committed number is traceable to a grid cell and a month. The contract is
                defined once in <code>data/schemas/</code>, checked in CI, and documented field
                by field.
              </p>
              <ul className="checklist">
                <li>
                  <code>null</code> means missing; <code>0</code> means measured-zero. Never
                  mixed.
                </li>
                <li>
                  <code>harm</code> is the only field the calendar aggregates; raw counts stay
                  for transparency.
                </li>
                <li>
                  Pre-2012 is MODIS alone, and the interface says so instead of hiding the seam.
                </li>
              </ul>
              <a className="text-link" href={`${REPO_URL}blob/main/docs/data-dictionary.md`}>
                Read the data dictionary <span aria-hidden="true">→</span>
              </a>
            </div>
            <pre className="code" tabIndex={0}>
              <code>{`[
  {
    "cell": "-10.2_-73.5",
    "y": 2019,
    "m": 9,
    "modis": 12,
    "viirs": 51,
    "harm": 12.4
  }
]`}</code>
            </pre>
          </div>
        </section>

        <aside className="callout" aria-labelledby="limit-title">
          <p className="eyebrow">Read this before citing us</p>
          <h2 id="limit-title">A hotspot is not a confirmed fire.</h2>
          <p>
            NinaCal reports satellite thermal detections, aggregated to ~11 km cells and
            months. It cannot tell a wildfire from agricultural burning, and it misses small,
            cool or cloud-covered fires. Use it to see patterns and anomalies, not to count
            incidents.
          </p>
          <a className="text-link" href={`${REPO_URL}blob/main/docs/limitations.md`}>
            Full list of limitations <span aria-hidden="true">→</span>
          </a>
        </aside>
      </main>

      <footer className="site-footer">
        <div>
          <span className="wordmark">
            ninacal<span aria-hidden="true">.</span>
          </span>
          <p>
            Open source under MIT. Data from NASA FIRMS / EOSDIS. Built for the NASA Space Apps
            Challenge 2026.
          </p>
        </div>
        <ul className="footer-links">
          <li>
            <a href={`${REPO_URL}blob/main/docs/methodology.md`}>Methodology</a>
          </li>
          <li>
            <a href={`${REPO_URL}blob/main/CONTRIBUTING.md`}>Contributing</a>
          </li>
          <li>
            <a href={`${REPO_URL}blob/main/SECURITY.md`}>Security</a>
          </li>
          <li>
            <a href={`${REPO_URL}blob/main/LICENSE`}>MIT</a>
          </li>
        </ul>
      </footer>
    </>
  );
}
