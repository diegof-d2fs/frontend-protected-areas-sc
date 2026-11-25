import type { SubmissionView } from "@/lib/api/imports"
import { SCENARIOS } from "@/lib/scenarios"

export interface ScenarioLabel {
  code: string
  title: string
}

function byId(id: string): ScenarioLabel {
  const scenario = SCENARIOS.find((item) => item.id === id)!
  return { code: scenario.code, title: scenario.title }
}

/**
 * Cenário de uma importação a partir do que a API guarda (domínio, operação e geometria
 * validada), já que o histórico vem do servidor e não da tela que fez o envio. `UC-CW01` e
 * `UC-CW02` usam o mesmo `uc/create`: um arquivo só de pontos é o cadastro pontual.
 */
export function scenarioForSubmission(submission: SubmissionView): ScenarioLabel {
  const { domain, operation, geometry_types: types = [] } = submission
  if (operation === "create_with_zone") return byId("uc-cw03")
  if (operation === "update") return byId("uc-cw04")
  if (operation === "extinguish") return byId("uc-cw05")
  if (operation === "replace_point") return byId("uc-cw06")
  if (operation === "replace_buffer_abrangencia") return byId("uc-cw07")
  if (domain === "za_oficial") {
    return { code: "UC-CW03", title: "Validação da zona de amortecimento oficial (ainda fora de um lote)" }
  }
  if (types.length > 0 && types.every((type) => type === "Point" || type === "MultiPoint")) {
    return byId("uc-cw02")
  }
  return byId("uc-cw01")
}
