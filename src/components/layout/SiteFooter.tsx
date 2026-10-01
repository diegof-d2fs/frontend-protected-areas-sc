import univaliLogo from "@/assets/univali-logo.png"
import { BRANDING } from "@/lib/branding"

// Rodapé institucional, presente em toda tela do produto: repete a marca e atribui a origem dos
// dados e a autoria. Fundo na cor de marca fixa (não muda com o tema, ao contrário do resto da
// interface) para a logo se fundir visualmente ao fundo, do jeito que ela já vem desenhada. O
// texto vem de `lib/branding.ts`, único lugar a editar se algum desses dados mudar.
export function SiteFooter() {
  return (
    <footer className="bg-brand text-brand-foreground">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-6 text-center text-xs">
        <img src={univaliLogo} alt="Univali" className="h-14 w-14 rounded-md" />
        <div className="space-y-1 opacity-90">
          <p className="text-balance">
            Base de dados gerada no Trabalho de Conclusão de Curso {BRANDING.tccTitle}.
          </p>
          <p>
            © {BRANDING.year} {BRANDING.authorName}, {BRANDING.institution}. Todos os direitos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
