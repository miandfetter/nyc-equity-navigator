import './Header.css'

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">⬡</div>
        <div className="header-title">
          <span className="header-brand">NYC</span>
          <span className="header-name">Equity Navigator</span>
        </div>
      </div>
      <div className="header-center">
        <span className="header-tag">Powered by Gemini 2.0 Flash</span>
        <span className="header-dot">·</span>
        <span className="header-tag">Grounded on NYC Open Data</span>
        <span className="header-dot">·</span>
        <span className="header-tag">Google Cloud Run</span>
      </div>
      <div className="header-right">
        <a
          href="https://data.cityofnewyork.us/Business/Neighborhood-Financial-Health-Digital-Mapping-and-/r3dx-pew9/about_data"
          target="_blank"
          rel="noopener noreferrer"
          className="header-link"
        >
          Data Source ↗
        </a>
      </div>
    </header>
  )
}
