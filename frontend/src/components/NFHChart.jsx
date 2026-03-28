import { useEffect, useRef } from 'react'
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

export default function NFHChart({ metrics }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !metrics?.length) return

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    const ctx = canvasRef.current.getContext('2d')

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: metrics.map(m => m.label),
        datasets: [
          {
            label: 'Neighborhood',
            data: metrics.map(m => m.neighborhood),
            backgroundColor: 'rgba(245, 200, 66, 0.85)',
            borderColor: 'rgba(245, 200, 66, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'City Average',
            data: metrics.map(m => m.city_avg),
            backgroundColor: 'rgba(138, 136, 128, 0.3)',
            borderColor: 'rgba(138, 136, 128, 0.6)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8a8880',
              font: { size: 11, family: "'DM Mono', monospace" },
              boxWidth: 10,
              boxHeight: 10,
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: '#12121a',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#e8e6df',
            bodyColor: '#8a8880',
            titleFont: { size: 12, family: "'Syne', sans-serif" },
            bodyFont: { size: 11, family: "'DM Mono', monospace" },
            padding: 12,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#5a5856',
              font: { size: 10, family: "'DM Mono', monospace" },
              maxRotation: 30,
            },
            border: { color: 'rgba(255,255,255,0.06)' },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#5a5856',
              font: { size: 10, family: "'DM Mono', monospace" },
            },
            border: { color: 'rgba(255,255,255,0.06)' },
          },
        },
      },
    })

    return () => chartRef.current?.destroy()
  }, [metrics])

  return (
    <div style={{ height: '200px', position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
