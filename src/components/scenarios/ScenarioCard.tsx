import {
  ArrowRight,
  FileUp,
  MapPin,
  PackagePlus,
  RefreshCw,
  Shapes,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Scenario } from "@/lib/scenarios"

const ICONS: Record<string, LucideIcon> = {
  "uc-cw01": FileUp,
  "uc-cw02": MapPin,
  "uc-cw03": PackagePlus,
  "uc-cw04": RefreshCw,
  "uc-cw05": Trash2,
  "uc-cw06": Shapes,
  "uc-cw07": ShieldCheck,
}

// Todo cartão leva à própria tela do cenário, inclusive os desabilitados — a explicação de por
// que não está disponível fica mais visível lá do que só num tooltip (que, além disso, não
// funciona em toque). O tooltip continua existindo como atalho no mouse, não como único acesso.
export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const Icon = ICONS[scenario.id] ?? FileUp
  const isActive = scenario.status === "active"

  const card = (
    <Link to={`/cenarios/${scenario.slug}`} className="block focus-visible:outline-none">
      <Card
        className={
          "h-full transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring" +
          (isActive ? " border-primary/40" : " opacity-60")
        }
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <Icon
              className={isActive ? "size-5 text-primary" : "size-5 text-muted-foreground"}
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-muted-foreground">{scenario.code}</span>
          </div>
          <CardTitle className="text-base">{scenario.title}</CardTitle>
          <CardDescription>{scenario.description}</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter>
          {isActive ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Ver cenário
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          ) : (
            <Badge variant={scenario.status === "not_in_api" ? "outline" : "secondary"}>
              {scenario.disabledReason}
            </Badge>
          )}
        </CardFooter>
      </Card>
    </Link>
  )

  if (isActive) {
    return card
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent>{scenario.disabledReason}</TooltipContent>
    </Tooltip>
  )
}
