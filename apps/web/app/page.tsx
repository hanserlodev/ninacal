import { COUNTRIES } from "@/lib/countries";

const REPO_URL = "https://github.com/hanserlodev/ninacal";

const LIVE_COUNTRIES = COUNTRIES.length;

const METRICS = [
  { value: "23", unit: "years", label: "2003 → 2025 on one scale" },
  { value: "0.05°", unit: "grid", label: "≈ 5.5 km cells, country-masked" },
  { value: String(LIVE_COUNTRIES), unit: "live", label: "countries served by the API" },
  { value: "57.3 M", unit: "rows", label: "monthly cell rows in the bundle" },
];

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9Z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4M8 14h3M8 17.5h6" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2.5 12.5h4l2.2-6 3.6 12 2.4-7 1.8 4h5" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 3v12m0 0 4.2-4.2M12 15l-4.2-4.2M4 17.5v1.5A2 2 0 0 0 6 21h12a2 2 0 0 0 2-2v-1.5" />
    </svg>
  );
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
          <a href="/console/">Console</a>
          <a href="#how">Method</a>
          <a href="#data">Data</a>
          <a href="/demo/">Demo</a>
          <a className="nav-cta" href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-badge">
              <span className="hero-badge-dot" aria-hidden="true" />
              NASA Space Apps 2026 · Fire records, harmonized
            </p>
            <h1 id="hero-title">
              Twenty-three years of fire,
              <span className="hero-em"> one calendar.</span>
            </h1>
            <p className="lede">
              Aqua/MODIS and Suomi-NPP/VIIRS do not agree. NinaCal brings both onto one
              detected-hotspot-day scale from 2003 to 2025 — with a NOAA-20 bridge for selected
              outages — on a 0.05° grid you can explore country by country.
            </p>
            <div className="actions">
              <a className="btn btn--primary" href="/console/">
                Open mission control <span aria-hidden="true">→</span>
              </a>
              <a className="btn" href={`${REPO_URL}/blob/main/docs/data-v2/DATA_CONTRACT.md`}>
                Data contract
              </a>
            </div>
            <ul className="hero-meta" aria-label="Project facts">
              <li>Open source · MIT</li>
              <li>Static frontend</li>
              <li>Read-only API</li>
              <li>NASA FIRMS</li>
            </ul>
          </div>

          <aside className="hero-panel" aria-label="Dataset at a glance">
            <div className="hero-globe" aria-hidden="true">
              <span className="hero-globe-grid" />
              <span className="hero-globe-glow" />
              <span className="hero-globe-point is-a" />
              <span className="hero-globe-point is-b" />
              <span className="hero-globe-point is-c" />
            </div>
            <div className="hero-panel-head">
              <span className="hero-panel-kicker">Live coverage</span>
              <span className="hero-panel-live">
                <span aria-hidden="true" />
                API online
              </span>
            </div>
            <p className="hero-panel-title">
              {LIVE_COUNTRIES} countries,
              <br />
              23 years,
              <br />
              <em>one grid.</em>
            </p>
            <dl className="hero-panel-grid">
              <div>
                <dt>Grid</dt>
                <dd>0.05°</dd>
              </div>
              <div>
                <dt>Span</dt>
                <dd>2003–25</dd>
              </div>
              <div>
                <dt>Cell</dt>
                <dd>≈5.5 km</dd>
              </div>
              <div>
                <dt>Layers</dt>
                <dd>MODIS · VIIRS · NOAA-20</dd>
              </div>
            </dl>
            <p className="hero-panel-foot">
              Every year is stored once and cached in the browser, so playback loops are instant
              after the first pass.
            </p>
          </aside>
        </section>

        <section className="metrics" aria-label="Key numbers">
          {METRICS.map((metric) => (
            <div className="metric" key={metric.unit}>
              <p className="metric-value">
                {metric.value}
                <span className="metric-unit">{metric.unit}</span>
              </p>
              <p className="metric-label">{metric.label}</p>
            </div>
          ))}
        </section>

        <section className="section" id="how" aria-labelledby="how-title">
          <div className="section-head">
            <p className="eyebrow">01 — pipeline</p>
            <h2 id="how-title">From raw detections to a readable calendar</h2>
          </div>
          <ol className="steps">
            <li>
              <span className="step-num">01</span>
              <h3>Aggregate</h3>
              <p>
                Screened satellite observations are grouped by 0.05° cell and month. The value
                counts detected hotspot-days — not raw pixels or individual fires.
              </p>
            </li>
            <li>
              <span className="step-num">02</span>
              <h3>Harmonize</h3>
              <p>
                Aqua/MODIS hotspot-days are converted to the Suomi-NPP scale. NOAA-20 fills
                selected outages; the model and its error are shown in the console.
              </p>
            </li>
            <li>
              <span className="step-num">03</span>
              <h3>Read</h3>
              <p>
                Draw a country, box or polygon. The API filters published cell centres, respects
                source availability, and returns one aggregate for every chart and export.
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
              <span className="card-icon">
                <IconCalendar />
              </span>
              <h3>Which months burn most?</h3>
              <p>
                A year × month heatmap over the whole record, with an accessible ramp and the
                exact numbers one click away.
              </p>
            </li>
            <li className="card">
              <span className="card-icon">
                <IconPulse />
              </span>
              <h3>Is this month unusual?</h3>
              <p>
                The latest month against the median of the same month in previous years, with a
                robust standardized anomaly.
              </p>
            </li>
            <li className="card">
              <span className="card-icon">
                <IconGlobe />
              </span>
              <h3>Can I trust the 2012 seam?</h3>
              <p>
                Cross-validation WAPE, RMSE and the chosen calibration are published in the
                mission-control validation panel.
              </p>
            </li>
            <li className="card">
              <span className="card-icon">
                <IconDownload />
              </span>
              <h3>Can I take the numbers?</h3>
              <p>
                Export harmonized hotspot-days per 0.05° cell and month as CSV, generated in the
                browser with no account and no backend.
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
                formal contract and caveats live in the repository beside the data.
              </p>
              <ul className="checklist">
                <li>
                  Sparse absence means zero only inside published cell support and an available
                  month; unavailable sources stay unknown.
                </li>
                <li>
                  <code>harm</code> is detected hotspot-days on the Suomi-NPP scale — not a fire
                  count and not burned area.
                </li>
                <li>
                  Early years are Aqua/MODIS estimates; later years use Suomi-NPP or selected
                  NOAA-20 fallback months, all on one scale.
                </li>
              </ul>
              <a className="text-link" href={`${REPO_URL}/blob/main/docs/data-v2/DATA_CONTRACT.md`}>
                Read the v2 data contract <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="record">
              <div className="record-head">
                <span>cells/2019/01.json</span>
                <span className="record-dot" aria-hidden="true" />
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
          </div>
        </section>

        <section className="console-cta" aria-labelledby="console-cta-title">
          <div>
            <p className="eyebrow">Mission control · live</p>
            <h2 id="console-cta-title">The map, the calendar and the evidence in one room.</h2>
            <p>
              A dark globe with 0.05° cells, an orbitable camera, a looping 2003–2025 timeline,
              any-country comparison and the model evaluation — all in one instrument.
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
            NinaCal reports satellite thermal detections aggregated to ~5.5 km cells and months.
            It cannot tell a wildfire from agricultural burning, and it misses small, cool or
            cloud-covered fires. Use it to see patterns and anomalies, not to count incidents.
          </p>
          <a className="text-link" href={`${REPO_URL}/blob/main/docs/limitations.md`}>
            Full list of limitations <span aria-hidden="true">→</span>
          </a>
        </aside>
      </main>

      <section className="closing" aria-label="Closing note and acknowledgments">
        <blockquote className="closing-quote">
          <p>“We are a way for the cosmos to know itself.”</p>
          <footer>
            Carl Sagan, <cite>Cosmos</cite> (1980)
          </footer>
          <p lang="es">“Somos una forma que tiene el cosmos de conocerse a sí mismo.”</p>
        </blockquote>
        <div className="closing-thanks">
          <p>
            Built on open NASA FIRMS data. Thanks to the NASA FIRMS and EOSDIS teams, to the MODIS
            and VIIRS science teams, and to our families and to the person each of us goes home to.
          </p>
          <p lang="es">
            Construido sobre datos abiertos de NASA FIRMS. Gracias a los equipos de NASA FIRMS y
            EOSDIS, a los equipos de ciencia de MODIS y VIIRS, y a nuestras familias y a la persona con la que cada uno vuelve a casa.
          </p>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <span className="wordmark">
            ninacal<span aria-hidden="true">.</span>
          </span>
          <p>
            Open source under MIT. Data from NASA FIRMS / EOSDIS. A world-ready pipeline served
            through a read-only API. Built for the NASA Space Apps Challenge 2026. AI coding
            assistance was used for code, documentation and analysis; all outputs were reviewed and
            tested. No AI-generated imagery, audio or video. Not affiliated with or endorsed by
            NASA.
          </p>
        </div>
        <ul className="footer-links">
          <li>
            <a href={`${REPO_URL}/blob/main/docs/methodology.md`}>Methodology</a>
          </li>
          <li>
            <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}>Contributing</a>
          </li>
          <li>
            <a href={`${REPO_URL}/blob/main/SECURITY.md`}>Security</a>
          </li>
          <li>
            <a href={`${REPO_URL}/blob/main/LICENSE`}>MIT</a>
          </li>
        </ul>
      </footer>
    </>
  );
}
