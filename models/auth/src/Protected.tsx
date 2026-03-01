import { Link } from 'react-router-dom'
import WeatherDropdown from './WeatherDropdown.tsx'

export default function Protected() {
  return (
    <div style={{ padding: 24 }}>
      You are logged in
      <Link to="/user-info"><button>User info</button></Link>
      <WeatherDropdown />
    </div>
  )
}
