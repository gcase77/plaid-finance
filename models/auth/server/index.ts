import 'dotenv/config'
import express from 'express'
import { requestLogger } from './middleware'
import weatherRoutes from './routes/weather'
import stocksRoutes from './routes/stocks'

const PORT = Number(process.env.PORT ?? 8000)

const app = express()
app.disable('x-powered-by')
app.use(requestLogger)
app.use('/api', weatherRoutes)
app.use('/api', stocksRoutes)

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`))
