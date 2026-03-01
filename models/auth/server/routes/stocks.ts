import { Router } from 'express'

const STOCKS: Record<string, { ticker: string; price: number; change: number }> = {
  aapl: { ticker: 'AAPL', price: 189.5, change: 1.2 },
  msft: { ticker: 'MSFT', price: 415.3, change: -0.8 },
  tsla: { ticker: 'TSLA', price: 248.7, change: 3.5 },
}

const router = Router()

router.get('/stocks', (req, res) => {
  const ticker = typeof req.query.ticker === 'string' ? req.query.ticker : ''
  const data = STOCKS[ticker.toLowerCase()]
  if (!data) return res.status(404).json({ error: 'Unknown ticker' })
  return res.json(data)
})

export default router
