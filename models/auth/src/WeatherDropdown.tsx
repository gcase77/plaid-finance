import { useState } from 'react'
import { supabase } from './lib/supabase'

const CITIES = ['nyc', 'sf', 'london'] as const

export default function WeatherDropdown() {
  const [city, setCity] = useState<string>('')
  const [weather, setWeather] = useState<object | null>(null)
  const fetchWeather = async (c: string) => {
    if (!c) return
    setCity(c)
    setWeather(null)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch(`/api/weather?city=${encodeURIComponent(c)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const body = await res.json()
      setWeather(body)
    } catch {
      setWeather({ error: 'Failed to load' })
    }
  }
  return (
    <div style={{ marginTop: 16 }}>
      <label>Weather </label>
      <select value={city} onChange={e => fetchWeather(e.target.value)}>
        <option value="">Select city</option>
        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {weather && <pre style={{ marginTop: 8, border: '1px solid #ccc', padding: 8 }}>{JSON.stringify(weather, null, 2)}</pre>}
    </div>
  )
}
