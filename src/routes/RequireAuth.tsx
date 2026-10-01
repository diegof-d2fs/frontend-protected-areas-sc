import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

/**
 * Único ponto de checagem de sessão da interface: nenhuma rota fora de `/login` é acessível sem
 * usuário autenticado. A checagem de autorização de verdade sempre acontece no backend a partir
 * da sessão validada no servidor; isto aqui é conveniência de navegação para a experiência do
 * usuário, nunca controle de acesso por si só.
 */
export function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
