import { useState, useEffect, useRef } from 'react'
import './MapPanel.css'

const NEIGHBORHOODS = [
  { neighborhood: 'Brownsville', borough: 'Brooklyn', lat: 40.6628, lng: -73.9093 },
  { neighborhood: 'Upper East Side', borough: 'Manhattan', lat: 40.7736, lng: -73.9566 },
  { neighborhood: 'Mott Haven', borough: 'Bronx', lat: 40.8101, lng: -73.9249 },
  { neighborhood: 'Tribeca', borough: 'Manhattan', lat: 40.7163, lng: -74.0086 },
  { neighborhood: 'East New York', borough: 'Brooklyn', lat: 40.6659, lng: -73.8785 },
  { neighborhood: 'Astoria', borough: 'Queens', lat: 40.7721, lng: -73.9301 },
  { neighborhood: 'Hunts Point', borough: 'Bronx', lat: 40.8157, lng: -73.8897 },
  { neighborhood: 'Park Slope', borough: 'Brooklyn', lat: 40.6681, lng: -73.9800 },
  { neighborhood: 'Harlem', borough: 'Manhattan', lat: 40.8116, lng: -73.9465 },
  { neighborhood: 'Flushing', borough: 'Queens', lat: 40.7675, lng: -73.8330 },
  { neighborhood: 'Jamaica', borough: 'Queens', lat: 40.6912, lng: -73.8065 },
  { neighborhood: 'Bedford-Stuyvesant', borough: 'Brooklyn', lat: 40.6872, lng: -73.9418 },
  { neighborhood: 'Crown Heights', borough: 'Brooklyn', lat: 40.6694, lng: -73.9422 },
  { neighborhood: 'Washington Heights', borough: 'Manhattan', lat: 40.8448, lng: -73.9393 },
  { neighborhood: 'Flatbush', borough: 'Brooklyn', lat: 40.6414, lng: -73.9610 },
  { neighborhood: 'Soundview', borough: 'Bronx', lat: 40.8210, lng: -73.8711 },
  { neighborhood: 'Forest Hills', borough: 'Queens', lat: 40.7184, lng: -73.8456 },
  { neighborhood: 'Staten Island', borough: 'Staten Island', lat: 40.5795, lng: -74.1502 },
]

export default function MapPanel({ onNeighborhoodSelect, selectedNeighborhood }) {
  const [search, setSearch] = useState('')
  const mapRef = useRef(null)
  const leafletMap = useRef(null)
  const markersRef = useRef({})

  useEffect(() => {
    // Dynamically load Leaflet CSS + JS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const loadLeaflet = async () => {
      if (!window.L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      if (leafletMap.current || !mapRef.current) return

      const L = window.L

      // Init map centered on NYC
      const map = L.map(mapRef.current, {
        center: [40.7128, -74.0060],
        zoom: 11,
        zoomControl: true,
      })

      // Stamen Toner Lite — clean, illustrated style, free, no API key
      L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; Stadia Maps &copy; Stamen Design &copy; OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)

      leafletMap.current = map

      // Add markers
      NEIGHBORHOODS.forEach(n => {
        const isSelected = n.neighborhood === selectedNeighborhood

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width: ${isSelected ? 16 : 12}px;
            height: ${isSelected ? 16 : 12}px;
            background: ${isSelected ? '#E8874A' : '#B5680A'};
            border: 2px solid ${isSelected ? '#fff' : '#F5C842'};
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.15s;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [isSelected ? 16 : 12, isSelected ? 16 : 12],
          iconAnchor: [isSelected ? 8 : 6, isSelected ? 8 : 6],
        })

        const marker = L.marker([n.lat, n.lng], { icon })
          .addTo(map)
          .bindTooltip(n.neighborhood, {
            permanent: false,
            direction: 'top',
            className: 'neighborhood-tooltip',
            offset: [0, -8],
          })
          .on('click', () => onNeighborhoodSelect(n.neighborhood))

        markersRef.current[n.neighborhood] = { marker, data: n }
      })
    }

    loadLeaflet()

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove()
        leafletMap.current = null
      }
    }
  }, [])

  // Update marker styles when selection changes
  useEffect(() => {
    if (!window.L || !leafletMap.current) return
    const L = window.L

    Object.entries(markersRef.current).forEach(([name, { marker }]) => {
      const isSelected = name === selectedNeighborhood
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: ${isSelected ? 16 : 12}px;
          height: ${isSelected ? 16 : 12}px;
          background: ${isSelected ? '#E8874A' : '#B5680A'};
          border: 2px solid ${isSelected ? '#fff' : '#F5C842'};
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ${isSelected ? 'box-shadow: 0 0 0 4px rgba(232,135,74,0.3), 0 2px 6px rgba(0,0,0,0.3);' : ''}
        "></div>`,
        iconSize: [isSelected ? 16 : 12, isSelected ? 16 : 12],
        iconAnchor: [isSelected ? 8 : 6, isSelected ? 8 : 6],
      })
      marker.setIcon(icon)
    })
  }, [selectedNeighborhood])

  // Handle suggestion events
  useEffect(() => {
    const handler = (e) => {
      setSearch(e.detail)
      onNeighborhoodSelect(e.detail)
    }
    document.addEventListener('suggest-neighborhood', handler)
    return () => document.removeEventListener('suggest-neighborhood', handler)
  }, [onNeighborhoodSelect])

  const filtered = search.length > 1
    ? NEIGHBORHOODS.filter(n =>
        n.neighborhood.toLowerCase().includes(search.toLowerCase()) ||
        n.borough.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const handleSelect = (name) => {
    setSearch('')
    onNeighborhoodSelect(name)
    // Pan map to selected neighborhood
    const entry = markersRef.current[name]
    if (entry && leafletMap.current) {
      leafletMap.current.setView([entry.data.lat, entry.data.lng], 13, { animate: true })
    }
  }

  return (
    <div className="map-panel">
      <div className="map-search">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search neighborhood…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
      </div>

      {search.length > 1 && (
        <div className="search-dropdown">
          {filtered.slice(0, 8).map(n => (
            <button key={n.neighborhood} className="search-result" onClick={() => handleSelect(n.neighborhood)}>
              <span className="result-name">{n.neighborhood}</span>
              <span className="result-borough">{n.borough}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="search-empty">No results</div>}
        </div>
      )}

      <div ref={mapRef} style={{ flex: 1, width: '100%', minHeight: 0 }} />

      <style>{`
        .neighborhood-tooltip {
          background: rgba(18,18,26,0.92) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 6px !important;
          color: #e8e6df !important;
          font-family: 'Syne', sans-serif !important;
          font-size: 12px !important;
          padding: 4px 10px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        .neighborhood-tooltip::before { display: none !important; }
        .leaflet-control-attribution { font-size: 9px !important; }
      `}</style>
    </div>
  )
}
