import { supabase } from './supabase-client.js'

export async function requestLogger(req, res, next) {
  const authHeader = req.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    console.log('auth.getUser: missing bearer token')
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) {
    console.log('auth.getUser result:', { error, user: data?.user })
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  console.log('auth.getUser result:', { error: null, user: data.user })

  req.user = data.user

  return next()
}

