import univaliLogo from "@/assets/univali-logo.png"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { BRANDING } from "@/lib/branding"

// Cabeçalho institucional, presente em toda tela do produto, incluindo o login e as áreas
// autenticadas. Logo à esquerda, nome do produto centralizado, alternador de tema na ponta
// oposta. A faixa fina no topo é o único uso de degradê do produto, feito de propósito.
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div
        className="h-1"
        style={{
          background: "linear-gradient(to right, var(--brand-dark), var(--brand), var(--brand-light))",
        }}
      />
      <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-2">
        <img
          src={univaliLogo}
          alt="Univali"
          className="h-12 w-12 justify-self-start rounded-md"
        />
        <p className="justify-self-center text-base font-semibold text-foreground">
          {BRANDING.productName}
        </p>
        <div className="justify-self-end">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
