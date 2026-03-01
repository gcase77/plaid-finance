import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

export default function RequireAuth() {
  const [claims, setClaims] = useState<object | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getClaims().then(({ data }) => setClaims(data?.claims ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getClaims().then(({ data }) => setClaims(data?.claims ?? null))
    })
    return () => subscription.unsubscribe()
  }, [])

  if (claims === undefined) return null
  if (!claims) return <Navigate to="/sign-in" replace />
  return <Outlet />
}
