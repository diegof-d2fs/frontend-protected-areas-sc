export type ScenarioStatus = "active" | "coming_soon" | "not_in_api"

export interface Scenario {
  id: string
  slug: string
  code: string
  title: string
  description: string
  status: ScenarioStatus
  /** Motivo mostrado no tooltip quando o cartão está desabilitado. */
  disabledReason?: string
}

export const SCENARIOS: Scenario[] = [
  {
    id: "uc-cw01",
    slug: "cadastrar-unidade",
    code: "UC-CW01",
    title: "Cadastrar unidade de conservação",
    description:
      "Envia um arquivo (Shapefile em ZIP, GeoJSON ou KML) com uma ou várias unidades de conservação.",
    status: "active",
  },
  {
    id: "uc-cw02",
    slug: "cadastrar-unidade-pontual",
    code: "UC-CW02",
    title: "Cadastrar unidade de conservação pontual",
    description:
      "Envia um arquivo (Shapefile em ZIP, GeoJSON ou KML) com uma ou várias unidades de conservação representadas por ponto.",
    status: "active",
  },
  {
    id: "uc-cw03",
    slug: "cadastrar-unidade-com-zona-oficial",
    code: "UC-CW03",
    title: "Cadastrar unidade de conservação com zona de amortecimento oficial",
    description: "Cria a unidade de conservação e a zona de amortecimento oficial num único lote.",
    status: "active",
  },
  {
    id: "uc-cw04",
    slug: "atualizar-unidade",
    code: "UC-CW04",
    title: "Atualizar unidade de conservação existente",
    description: "Busca a unidade pelo identificador forte e atualiza os dados geoespaciais.",
    status: "active",
  },
  {
    id: "uc-cw05",
    slug: "extinguir-unidade",
    code: "UC-CW05",
    title: "Extinguir unidade de conservação",
    description: "Encerra o registro de uma unidade de conservação existente.",
    status: "active",
  },
  {
    id: "uc-cw06",
    slug: "substituir-ponto-por-poligono",
    code: "UC-CW06",
    title: "Substituir geometria pontual por poligonal",
    description: "Troca o registro pontual de uma unidade por uma geometria poligonal precisa.",
    status: "active",
  },
  {
    id: "uc-cw07",
    slug: "substituir-buffer-por-za-oficial",
    code: "UC-CW07",
    title: "Substituir Buffer de Abrangência por ZA oficial",
    description:
      "Informa o identificador da unidade, a justificativa e o arquivo da zona de amortecimento oficial.",
    status: "active",
  },
]
