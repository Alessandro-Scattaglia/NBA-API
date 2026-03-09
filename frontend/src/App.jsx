import { useState, useCallback } from 'react'

const ENDPOINTS = [
  { key: 'players', label: 'All Players', url: '/api/players' },
  { key: 'teams', label: 'All Teams', url: '/api/teams' },
  { key: 'standings', label: 'League Standings', url: '/api/standings' },
  { key: 'scoreboard', label: "Today's Scoreboard", url: '/api/scoreboard' },
]

function EndpointSection({ label, url }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [url])

  return (
    <section style={{ marginBottom: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}>
      <h2>{label}</h2>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading…' : 'Fetch'}
      </button>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {data && (
        <pre style={{ background: '#f4f4f4', padding: '1rem', overflow: 'auto', maxHeight: '300px' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  )
}

function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <h1>NBA API Explorer</h1>
      {ENDPOINTS.map((ep) => (
        <EndpointSection key={ep.key} label={ep.label} url={ep.url} />
      ))}
    </div>
  )
}

export default App

