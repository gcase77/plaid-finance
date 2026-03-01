import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase.ts'
import WeatherDropdown from './WeatherDropdown.tsx'

export default function UserInfo() {
  const [claims, setClaims] = useState<object | null>(null)
  useEffect(() => {
    supabase.auth.getClaims().then(({ data }) => setClaims(data?.claims ?? null))
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <Link to="/"><button>Home</button></Link>
      <h3>Claims</h3>
      <pre style={{ overflow: 'auto', maxHeight: 300, border: '1px solid #ccc', padding: 12 }}>{JSON.stringify(claims, null, 2)}</pre>
      <WeatherDropdown />
      <button
        onClick={async () => {
          await supabase.auth.refreshSession()
          const { data } = await supabase.auth.getClaims()
          setClaims(data?.claims ?? null)
        }}
      >
        Refresh session
      </button>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  )
}
