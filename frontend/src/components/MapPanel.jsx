import { useState, useEffect, useRef } from 'react'
import './MapPanel.css'

// NYC neighborhood coordinates (hardcoded fallback + augmented from API)
const DEFAULT_NEIGHBORHOODS = [
  { neighborhood: 'Brownsville', borough: 'Brooklyn', latitude: '40.6628', longitude: '-73.9093' },
  { neighborhood: 'Upper East Side', borough: 'Manhattan', latitude: '40.7736', longitude: '-73.9566' },
  { neighborhood: 'Mott Haven', borough: 'Bronx', latitude: '40.8101', longitude: '-73.9249' },
  { neighborhood: 'Tribeca', borough: 'Manhattan', latitude: '40.7163', longitude: '-74.0086' },
  { neighborhood: 'East New York', borough: 'Brooklyn', latitude: '40.6659', longitude: '-73.8785' },
  { neighborhood: 'Astoria', borough: 'Queens', latitude: '40.7721', longitude: '-73.9301' },
  { neighborhood: 'Hunts Point', borough: 'Bronx', latitude: '40.8157', longitude: '-73.8897' },
  { neighborhood: 'Park Slope', borough: 'Brooklyn', latitude: '40.6681', longitude: '-73.9800' },
  { neighborhood: 'Harlem', borough: 'Manhattan', latitude: '40.8116', longitude: '-73.9465' },
  { neighborhood: 'Flushing', borough: 'Queens', latitude: '40.7675', longitude: '-73.8330' },
  { neighborhood: 'Jamaica', borough: 'Queens', latitude: '40.6912', longitude: '-73.8065' },
  { neighborhood: 'Bedford-Stuyvesant', borough: 'Brooklyn', latitude: '40.6872', longitude: '-73.9418' },
  { neighborhood: 'Crown Heights', borough: 'Brooklyn', latitude: '40.6694', longitude: '-73.9422' },
  { neighborhood: 'Washington Heights', borough: 'Manhattan', latitude: '40.8448', longitude: '-73.9393' },
  { neighborhood: 'Flatbush', borough: 'Brooklyn', latitude: '40.6414', longitude: '-73.9610' },
  { neighborhood: 'Soundview', borough: 'Bronx', latitude: '40.8210', longitude: '-73.8711' },
  { neighborhood: 'Forest Hills', borough: 'Queens', latitude: '40.7184', longitude: '-73.8456' },
  { neighborhood: 'Staten Island', borough: 'Staten Island', latitude: '40.5795', longitude: '-74.1502' },
]

// NYC bounding box for projection
const NYC_BOUNDS = {
  minLat: 40.477,
  maxLat: 40.918,
  minLng: -74.260,
  maxLng: -73.700,
}

function project(lat, lng, width, height) {
  const x = ((parseFloat(lng) - NYC_BOUNDS.minLng) / (NYC_BOUNDS.maxLng - NYC_BOUNDS.minLng)) * width
  const y = height - ((parseFloat(lat) - NYC_BOUNDS.minLat) / (NYC_BOUNDS.maxLat - NYC_BOUNDS.minLat)) * height
  return { x, y }
}

export default function MapPanel({ onNeighborhoodSelect, selectedNeighborhood, apiBase }) {
  const [neighborhoods, setNeighborhoods] = useState(DEFAULT_NEIGHBORHOODS)
  const [search, setSearch] = useState('')
  const [hoveredN, setHoveredN] = useState(null)
  const svgRef = useRef(null)
  const [dims, setDims] = useState({ w: 600, h: 500 })

  useEffect(() => {
    // Try to fetch from API, fall back to defaults silently
    fetch(`${apiBase}/neighborhoods`)
      .then(r => r.json())
      .then(data => {
        const valid = data.filter(n => n.latitude && n.longitude && n.neighborhood)
        if (valid.length > 0) setNeighborhoods(valid)
      })
      .catch(() => {}) // silent fallback
  }, [apiBase])

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    if (svgRef.current?.parentElement) {
      obs.observe(svgRef.current.parentElement)
    }
    return () => obs.disconnect()
  }, [])

  // Handle suggestion events from App
  useEffect(() => {
    const handler = (e) => {
      setSearch(e.detail)
      onNeighborhoodSelect(e.detail)
    }
    document.addEventListener('suggest-neighborhood', handler)
    return () => document.removeEventListener('suggest-neighborhood', handler)
  }, [onNeighborhoodSelect])

  const filtered = search.length > 1
    ? neighborhoods.filter(n =>
        n.neighborhood?.toLowerCase().includes(search.toLowerCase()) ||
        n.borough?.toLowerCase().includes(search.toLowerCase())
      )
    : neighborhoods

  const handleSelect = (name) => {
    setSearch('')
    onNeighborhoodSelect(name)
  }

  return (
    <div className="map-panel">
      {/* Search bar */}
      <div className="map-search">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search neighborhood…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {search.length > 1 && (
        <div className="search-dropdown">
          {filtered.slice(0, 8).map(n => (
            <button
              key={n.neighborhood}
              className="search-result"
              onClick={() => handleSelect(n.neighborhood)}
            >
              <span className="result-name">{n.neighborhood}</span>
              <span className="result-borough">{n.borough}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="search-empty">No results — try a different name</div>
          )}
        </div>
      )}

      {/* SVG Map */}
      <div className="map-svg-container">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          className="map-svg"
        >
          {/* NYC borough outlines (simplified) */}
          <NycOutlines w={dims.w} h={dims.h} />

          {/* Neighborhood dots */}
          {DEFAULT_NEIGHBORHOODS.map(n => {
            const { x, y } = project(n.latitude, n.longitude, dims.w, dims.h)
            const isSelected = n.neighborhood === selectedNeighborhood
            const isHovered = n.neighborhood === hoveredN
            return (
              <g key={n.neighborhood}
                className="map-dot-group"
                onClick={() => handleSelect(n.neighborhood)}
                onMouseEnter={() => setHoveredN(n.neighborhood)}
                onMouseLeave={() => setHoveredN(null)}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <circle cx={x} cy={y} r={16} fill="var(--accent)" opacity={0.15} />
                )}
                <circle
                  cx={x} cy={y}
                  r={isSelected ? 7 : isHovered ? 6 : 5}
                  fill={isSelected ? 'var(--accent)' : isHovered ? 'var(--text)' : 'var(--text3)'}
                  stroke={isSelected ? 'var(--accent)' : 'var(--bg)'}
                  strokeWidth={2}
                  style={{ transition: 'all 0.15s ease' }}
                />
                {(isSelected || isHovered) && (
                  <text
                    x={x + 10} y={y + 4}
                    fill={isSelected ? 'var(--accent)' : 'var(--text)'}
                    fontSize="11"
                    fontFamily="var(--font-body)"
                    fontWeight={isSelected ? '600' : '400'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n.neighborhood}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Map legend */}
        <div className="map-legend">
          <div className="legend-item">
            <span className="legend-dot selected"></span>
            <span>Selected</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot"></span>
            <span>Neighborhood</span>
          </div>
        </div>

        {/* Borough labels */}
        <div className="map-label manhattan">Manhattan</div>
        <div className="map-label brooklyn">Brooklyn</div>
        <div className="map-label bronx">Bronx</div>
        <div className="map-label queens">Queens</div>
      </div>
    </div>
  )
}

function NycOutlines({ w, h }) {
  // Simplified NYC borough boundary paths (projected)
  const proj = (lat, lng) => project(lat, lng, w, h)

  // Rough Manhattan outline
  const manhattanPoints = [
    [40.7009, -74.0159], [40.7484, -74.0025], [40.8003, -73.9580],
    [40.8510, -73.9336], [40.8816, -73.9176], [40.8781, -73.9073],
    [40.8316, -73.9326], [40.7685, -73.9846], [40.7009, -74.0159],
  ].map(([lat, lng]) => proj(lat, lng))

  const toPath = (points) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'

  return (
    <g className="borough-outlines">
      <path
        d={toPath(manhattanPoints)}
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />
      {/* Grid overlay for aesthetics */}
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={w * (i + 1) / 9} y1={0}
          x2={w * (i + 1) / 9} y2={h}
          stroke="rgba(255,255,255,0.02)"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={0} y1={h * (i + 1) / 7}
          x2={w} y2={h * (i + 1) / 7}
          stroke="rgba(255,255,255,0.02)"
          strokeWidth="1"
        />
      ))}
    </g>
  )
}
