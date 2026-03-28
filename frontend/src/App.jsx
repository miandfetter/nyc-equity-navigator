import { useState, useEffect, useRef, useCallback } from 'react'
import MapPanel from './components/MapPanel.jsx'
import ProfilePanel from './components/ProfilePanel.jsx'
import Header from './components/Header.jsx'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default function App() {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null)
  const [streamState, setStreamState] = useState({
    status: null,
    chartData: null,
    narrative: '',
    images: [],
    done: false,
    error: null,
    loading: false,
  })
  const eventSourceRef = useRef(null)

  const analyzeNeighborhood = useCallback((name) => {
    // Close any existing stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setSelectedNeighborhood(name)
    setStreamState({
      status: 'Connecting…',
      chartData: null,
      narrative: '',
      images: [],
      done: false,
      error: null,
      loading: true,
    })

    const url = `${API_BASE}/analyze?neighborhood=${encodeURIComponent(name)}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'status') {
          setStreamState(prev => ({ ...prev, status: msg.message }))
        } else if (msg.type === 'chart') {
          setStreamState(prev => ({ ...prev, chartData: msg.payload }))
        } else if (msg.type === 'narrative_chunk') {
          setStreamState(prev => ({ ...prev, narrative: prev.narrative + msg.text }))
        } else if (msg.type === 'image') {
          setStreamState(prev => ({ ...prev, images: [...prev.images, msg.src] }))
        } else if (msg.type === 'done') {
          setStreamState(prev => ({ ...prev, done: true, loading: false, status: null }))
          es.close()
        } else if (msg.type === 'error') {
          setStreamState(prev => ({ ...prev, error: msg.message, loading: false, status: null }))
          es.close()
        }
      } catch (e) {
        console.error('SSE parse error', e)
      }
    }

    es.onerror = () => {
      setStreamState(prev => ({
        ...prev,
        error: 'Connection lost. Please try again.',
        loading: false,
        status: null,
      }))
      es.close()
    }
  }, [])

  useEffect(() => {
    return () => eventSourceRef.current?.close()
  }, [])

  return (
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <div className="map-col">
          <MapPanel
            onNeighborhoodSelect={analyzeNeighborhood}
            selectedNeighborhood={selectedNeighborhood}
            apiBase={API_BASE}
          />
        </div>
        <div className="profile-col">
          {!selectedNeighborhood ? (
            <EmptyState />
          ) : (
            <ProfilePanel
              neighborhood={selectedNeighborhood}
              streamState={streamState}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">⬡</div>
      <h2>Select a neighborhood</h2>
      <p>Click any point on the map or search by name to generate a live financial health profile.</p>
      <div className="empty-suggestions">
        <span>Try:</span>
        {['Brownsville', 'Upper East Side', 'Mott Haven', 'Tribeca'].map(n => (
          <button key={n} className="suggestion-chip"
            onClick={() => document.dispatchEvent(new CustomEvent('suggest-neighborhood', { detail: n }))}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
