import { Router } from 'express'

const WEATHER: Record<string, { city: string; tempF: number; condition: string }> = {
  nyc: { city: 'New York', tempF: 75, condition: 'Sunny' },
  sf: { city: 'San Francisco', tempF: 65, condition: 'Foggy' },
  london: { city: 'London', tempF: 60, condition: 'Cloudy' },
}

const router = Router()

router.get('/weather', (req, res) => {
  const city = typeof req.query.city === 'string' ? req.query.city : ''
  const data = WEATHER[city]
  if (!data) return res.status(404).json({ error: 'Unknown city' })
  return res.json(data)
})

export default router
