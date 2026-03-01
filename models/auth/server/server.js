import 'dotenv/config'
import express from 'express'
import { requestLogger } from './middleware.js'

const PORT = Number(process.env.PORT ?? 8000)

const WEATHER = {
  nyc: { city: 'New York', tempF: 75, condition: 'Sunny' },
  sf: { city: 'San Francisco', tempF: 65, condition: 'Foggy' },
  london: { city: 'London', tempF: 60, condition: 'Cloudy' },
}

const app = express()
app.disable('x-powered-by')
app.use(requestLogger)

app.get('/api/weather', async (req, res) => {
  const city = typeof req.query.city === 'string' ? req.query.city : ''
  const data = WEATHER[city]

  if (!data) return res.status(404).json({ error: 'Unknown city' })
  return res.json(data)
})

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

app.listen(PORT, () => {
  console.log(`Weather server listening on http://localhost:${PORT}`)
})

