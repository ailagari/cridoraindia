import { Navigate, useLocation } from 'react-router-dom'

export function RedirectPreserveSearch({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}
