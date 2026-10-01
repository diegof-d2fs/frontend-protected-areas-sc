import { ScenarioCard } from "@/components/scenarios/ScenarioCard"
import { SCENARIOS } from "@/lib/scenarios"

export function ScenarioFormPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Cenários de cadastro</h1>
        <p className="text-sm text-muted-foreground">
          Escolha um cenário para cadastrar ou atualizar dados geoespaciais de unidades de
          conservação.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCENARIOS.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </div>
    </div>
  )
}
