import { ArrowLeft } from "lucide-react"
import type { ReactElement } from "react"
import { Navigate, Link, useParams } from "react-router-dom"
import { UcCw04Form } from "@/components/scenarios/UcCw04Form"
import { UcCw03Form } from "@/components/scenarios/UcCw03Form"
import { UcCw05Form } from "@/components/scenarios/UcCw05Form"
import { UcCreateForm } from "@/components/scenarios/UcCreateForm"
import { UcCw07Form } from "@/components/scenarios/UcCw07Form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SCENARIOS } from "@/lib/scenarios"

// Cada cenário "active" precisa de uma entrada aqui. `UC-CW01`/`UC-CW02` compartilham o mesmo
// formulário de `uc/create` (só muda a geometria esperada, validada pela API); os demais têm
// tela própria porque o contrato de metadados é diferente.
const SCENARIO_FORMS: Record<string, () => ReactElement> = {
  "uc-cw01": () => <UcCreateForm scenarioId="uc-cw01" />,
  "uc-cw02": () => <UcCreateForm scenarioId="uc-cw02" />,
  "uc-cw03": () => <UcCw03Form />,
  "uc-cw04": () => <UcCw04Form />,
  "uc-cw05": () => <UcCw05Form />,
  "uc-cw06": () => <UcCw04Form operation="replace_point" />,
  "uc-cw07": () => <UcCw07Form />,
}

export function ScenarioDetailPage() {
  const { scenarioSlug } = useParams<{ scenarioSlug: string }>()
  const scenario = SCENARIOS.find((item) => item.slug === scenarioSlug || item.id === scenarioSlug)

  if (!scenario) {
    return <Navigate to="/cenarios" replace />
  }

  if (scenarioSlug !== scenario.slug) {
    return <Navigate to={`/cenarios/${scenario.slug}`} replace />
  }

  const renderForm = scenario.status === "active" ? SCENARIO_FORMS[scenario.id] : undefined

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/cenarios"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Todos os cenários
      </Link>

      <div>
        <span className="font-mono text-xs text-muted-foreground">{scenario.code}</span>
        <h1 className="text-lg font-semibold text-foreground">{scenario.title}</h1>
        <p className="text-sm text-muted-foreground">{scenario.description}</p>
      </div>

      {renderForm ? (
        renderForm()
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ainda não disponível</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={scenario.status === "not_in_api" ? "outline" : "secondary"}>
              {scenario.disabledReason}
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
