import { QueryClientProvider } from "@tanstack/react-query"
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import { AdminDashboardPage } from "@/pages/AdminDashboardPage"
import { DicionarioDadosPage } from "@/pages/DicionarioDadosPage"
import { HistoricoPage } from "@/pages/HistoricoPage"
import { ImportDetailPage } from "@/pages/ImportDetailPage"
import { LoginPage } from "@/pages/LoginPage"
import { ScenarioDetailPage } from "@/pages/ScenarioDetailPage"
import { ScenarioFormPage } from "@/pages/ScenarioFormPage"
import { RequireAdmin } from "@/routes/RequireAdmin"
import { RequireAuth } from "@/routes/RequireAuth"
import { queryClient } from "@/lib/queryClient"

// Cada papel tem uma página inicial diferente, então "/" nunca renderiza conteúdo próprio:
// só decide para onde mandar quem acabou de autenticar.
function RootRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === "admin" ? "/admin" : "/cenarios"} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/cenarios" element={<ScenarioFormPage />} />
          <Route path="/cenarios/:scenarioSlug" element={<ScenarioDetailPage />} />
          <Route path="/historico" element={<HistoricoPage />} />
          <Route path="/historico/:importId" element={<ImportDetailPage />} />
          <Route path="/dicionario-dados" element={<DicionarioDadosPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider>
              <div className="flex min-h-screen flex-col">
                <SiteHeader />
                <div className="flex flex-1 flex-col">
                  <AppRoutes />
                </div>
                <SiteFooter />
              </div>
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
