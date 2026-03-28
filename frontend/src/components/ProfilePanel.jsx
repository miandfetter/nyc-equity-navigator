import { useEffect, useRef } from 'react'
import NFHChart from './NFHChart.jsx'
import './ProfilePanel.css'

export default function ProfilePanel({ neighborhood, streamState }) {
  const { status, chartData, narrative, images, done, error, loading } = streamState
  const narrativeRef = useRef(null)

  // Auto-scroll narrative as it streams
  useEffect(() => {
    if (narrativeRef.current) {
      narrativeRef.current.scrollTop = narrativeRef.current.scrollHeight
    }
  }, [narrative])

  return (
    <div className="profile-panel">
      {/* Neighborhood header */}
      <div className="profile-header">
        <div className="profile-header-top">
          <span className="profile-tag">Neighborhood Profile</span>
          {loading && <span className="live-badge">● LIVE</span>}
          {done && <span className="done-badge">✓ Complete</span>}
        </div>
        <h1 className="profile-title">{neighborhood}</h1>
        {chartData?.summary_stats?.borough && (
          <div className="profile-meta">
            <span>{chartData.summary_stats.borough}</span>
            {chartData.summary_stats.data_year && (
              <><span className="meta-sep">·</span><span>{chartData.summary_stats.data_year}</span></>
            )}
          </div>
        )}
      </div>

      {/* Status indicator */}
      {status && (
        <div className="status-bar animate-fade">
          <span className="status-pulse"></span>
          <span className="status-text">{status}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-banner animate-fade">
          <span>⚠</span> {error}
        </div>
      )}

      {/* NFH Index hero metric */}
      {chartData && (
        <div className="metrics-hero animate-fade">
          <div className="metric-card accent">
            <div className="metric-label">NFH Index</div>
            <div className="metric-value">{chartData.nfh_index?.toFixed(1)}</div>
            <div className="metric-context">
              City avg: {chartData.city_avg_nfh?.toFixed(1)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">City Percentile</div>
            <div className="metric-value">{chartData.percentile}</div>
            <div className="metric-context">
              <PercentileBar value={chartData.percentile} />
            </div>
          </div>
          {chartData.summary_stats?.total_locations_analyzed > 0 && (
            <div className="metric-card">
              <div className="metric-label">Data Points</div>
              <div className="metric-value">{chartData.summary_stats.total_locations_analyzed}</div>
              <div className="metric-context">analyzed locations</div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {chartData?.metrics?.length > 0 && (
        <div className="chart-section animate-fade">
          <div className="section-label">Financial Health Metrics</div>
          <NFHChart metrics={chartData.metrics} />
        </div>
      )}

      {/* Skeleton chart while loading */}
      {loading && !chartData && (
        <div className="chart-section">
          <div className="section-label">Financial Health Metrics</div>
          <div className="skeleton" style={{ height: '200px', margin: '8px 0' }}></div>
        </div>
      )}

      {/* AI-Generated Street Imagery */}
      {images.length > 0 && (
        <div className="images-section animate-fade">
          <div className="section-label">
            AI-Generated Street Context
            <span className="section-badge">Imagen 3</span>
          </div>
          {images.map((src, i) => (
            <div key={i} className="street-image-container animate-slide">
              {src.startsWith('PROMPT:') ? (
                <div className="image-prompt-fallback">
                  <span className="fallback-icon">🏙</span>
                  <p>{src.replace('PROMPT:', '')}</p>
                </div>
              ) : (
                <img src={src} alt={`${neighborhood} street scene`} className="street-image" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skeleton image while loading */}
      {loading && images.length === 0 && narrative.length > 0 && (
        <div className="images-section">
          <div className="section-label">AI-Generated Street Context</div>
          <div className="skeleton" style={{ height: '200px' }}></div>
        </div>
      )}

      {/* Narrative Analysis (streaming) */}
      {(narrative || (loading && chartData)) && (
        <div className="narrative-section">
          <div className="section-label">
            Policy Analysis
            <span className="section-badge">Gemini</span>
          </div>
          <div className="narrative-body" ref={narrativeRef}>
            {narrative ? (
              <div className="narrative-text">
                {narrative.split('\n\n').map((para, i) => (
                  para.trim() ? <p key={i}>{formatParagraph(para)}</p> : null
                ))}
                {loading && <span className="cursor-blink">▋</span>}
              </div>
            ) : (
              <div>
                <div className="skeleton" style={{ height: '16px', marginBottom: '10px' }}></div>
                <div className="skeleton" style={{ height: '16px', width: '90%', marginBottom: '10px' }}></div>
                <div className="skeleton" style={{ height: '16px', width: '75%' }}></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Done state */}
      {done && (
        <div className="profile-footer animate-fade">
          <span>Profile generated from live NYC Open Data · Gemini 2.0 Flash</span>
        </div>
      )}
    </div>
  )
}

function PercentileBar({ value }) {
  const color = value < 30 ? 'var(--red)' : value < 60 ? 'var(--accent)' : 'var(--green)'
  return (
    <div className="percentile-bar-track">
      <div
        className="percentile-bar-fill"
        style={{ width: `${value}%`, background: color }}
      ></div>
    </div>
  )
}

function formatParagraph(text) {
  // Bold **text** → <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}
