// TODO: replace with the real repository URL before deployment.
const REPO_URL = "https://github.com/hanserlodev/ninacal";

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
          <a href="/console/">Console</a>
          <a href="#how">How it works</a>
          <a href="#data">Data</a>
          <a className="nav-cta" href={REPO_URL}>
            GitHub&nbsp;↗
          </a>
        </nav>
      </header>

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              NASA Space Apps 2026 · Harmonizing satellite fire records
            </p>
            <h1 id="hero-title">
              Twenty-three years of fire,
              <br />
              <em>one calendar.</em>
            </h1>
            <p className="lede">
              Aqua/MODIS and Suomi-NPP/VIIRS do not agree. NinaCal brings them onto one
              detected-hotspot-day scale from 2003 to 2025, with a NOAA-20 fallback for selected
              outages — across 12 countries in the Americas and Australia, with a globe and
              country/region drill-down.
            </p>
            <div className="actions">
              <a className="btn btn--primary" href="/console/">
                Open mission control <span aria-hidden="true">→</span>
              </a>
              <a className="btn" href={`${REPO_URL}blob/main/docs/data-v2/DATA_CONTRACT.md`}>
                Read the v2 data contract
              </a>
            </div>
            <p className="note">
              Open source · MIT · static frontend + optional read-only API · NASA FIRMS
            </p>
          </div>

          <aside className="hero-panel" aria-label="Dataset at a glance">
            <div className="hero-panel-head">
              <span className="hero-panel-kicker">Shipping coverage</span>
              <span className="hero-panel-live">
                <span aria-hidden="true" />
                Global · 12 countries
              </span>
            </div>
            <p className="hero-panel-title">
              Twelve countries,
              <br />
              <em>one grid.</em>
            </p>
            <div className="hero-panel-grid">
              <div>
                <span className="hero-panel-value">23</span>
                <span className="hero-panel-key">years</span>
              </div>
              <div>
                <span className="hero-panel-value">12</span>
                <span className="hero-panel-key">countries</span>
              </div>
              <div>
                <span className="hero-panel-value">0.05°</span>
                <span className="hero-panel-key">grid</span>
              </div>
              <div>
                <span className="hero-panel-value">1</span>
                <span className="hero-panel-key">series</span>
              </div>
            </div>
            <p className="hero-panel-foot">
              Aqua/MODIS estimated through Jan 2012 · Suomi-NPP observed from Feb 2012 ·
              NOAA-20 bridges selected outages. Harmonized values: 2003–2025.
            </p>
          </aside>
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
                Screened satellite observations are grouped by 0.05° cell and month. The
                value counts detected hotspot-days, not raw pixels or individual fires.
              </p>
            </li>
            <li>
              <span className="step-num">02</span>
              <h3>Harmonize</h3>
              <p>
                Aqua/MODIS hotspot-days are converted to the Suomi-NPP scale. NOAA-20 fills
                selected Suomi-NPP outages; the model and its test errors are shown in the
                console.
              </p>
            </li>
            <li>
              <span className="step-num">03</span>
              <h3>Read</h3>
              <p>
                Draw a region. The browser filters published cell centres, respects source
                availability, then builds the calendar and CSV from one aggregate.
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
              <p>
                A year × month heatmap over the whole record, with an accessible viridis ramp
                and the exact numbers one click away.
              </p>
            </li>
            <li className="card">
              <h3>Is this month unusual?</h3>
              <p>
                The latest month next to the median of the same month in previous years, with
                a robust standardized anomaly.
              </p>
            </li>
            <li className="card">
              <h3>Can I trust the 2012 seam?</h3>
              <p>
                Cross-validation WAPE, RMSE and the chosen calibration model are in the
                mission-control validation panel.
              </p>
            </li>
            <li className="card">
              <h3>Can I take the numbers?</h3>
              <p>
                Export harmonized detected hotspot-days per 0.05° cell and month as CSV — generated in the
                browser, no account, no backend.
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
                The v2 bundle stores monthly hotspot-day data in a compact columnar format. The
                formal contract and caveats are checked into the repository beside the data.
              </p>
              <ul className="checklist">
                <li>
                  Sparse absence means zero only inside published cell support and an
                  available month; unavailable sources remain unknown.
                </li>
                <li>
                  <code>harm</code> is detected hotspot-days on the Suomi-NPP scale; it is not a
                  fire count or burned area.
                </li>
                <li>
                  Early years are Aqua/MODIS estimates; later years use Suomi-NPP or selected
                  NOAA-20 fallback months, all on one scale.
                </li>
              </ul>
              <a className="text-link" href={`${REPO_URL}blob/main/docs/data-v2/DATA_CONTRACT.md`}>
                Read the v2 data contract <span aria-hidden="true">→</span>
              </a>
            </div>
            <pre className="code" tabIndex={0}>
              <code>{`[
  {
    "cell": "-18.25_-70.45",
    "y": 2019,
    "m": 1,
    "modis": 0,
    "terra": 0,
    "viirs": 0,
    "noaa20": 1,
    "harm": 0.0
  }
]`}</code>
            </pre>
          </div>
        </section>

        <section className="console-cta" aria-labelledby="console-cta-title">
          <div>
            <p className="eyebrow">Mission control · separate route</p>
            <h2 id="console-cta-title">The map, the calendar and the evidence in one room.</h2>
            <p>
              The console is the working instrument: a square-cell coverage map, satellite
              toggle, live cursor telemetry, the 2003–2025 archive and the model evaluation.
            </p>
          </div>
          <a className="btn btn--primary" href="/console/">
            Enter mission control <span aria-hidden="true">→</span>
          </a>
        </section>

        <aside className="callout" aria-labelledby="limit-title">
          <p className="eyebrow">Read this before citing us</p>
          <h2 id="limit-title">A hotspot is not a confirmed fire.</h2>
          <p>
            NinaCal reports satellite thermal detections, aggregated to ~5.5 km cells and
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
            Open source under MIT. Data from NASA FIRMS / EOSDIS. 12 published countries,
            world-ready pipeline. Built for the NASA Space Apps Challenge 2026.
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
