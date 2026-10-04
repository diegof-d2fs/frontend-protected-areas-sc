import { apiRequest } from "@/lib/api/client"

// Espelho do contrato de `GET /api/v1/data-dictionary`. O conteúdo vem sempre da API, montado a
// partir das mesmas regras da validação; a tela só formata, nunca fixa limites ou nomes de coluna.

export type ColumnRequirement = "obrigatorio" | "identificador_forte" | "opcional"
export type ColumnType = "texto" | "data" | "numero_decimal" | "inteiro" | "booleano"

export interface DictionaryColumn {
  name: string
  type: ColumnType
  requirement: ColumnRequirement
  aliases: string[]
  example: string
  description: string
  destination: string
}

export interface DictionaryMetadataField {
  name: string
  type: string
  required: boolean
  max_length: number | null
  minimum: number | null
  description: string
}

export interface DictionaryFormat {
  id: string
  label: string
  extensions: string[]
  required_files: string[]
  optional_files: string[]
  crs_rule: string
  encoding: string
  rules: string[]
}

export interface DictionaryLimit {
  key: string
  label: string
  value: number
  unit: string
}

export interface DictionaryError {
  code: string
  stage: string
  meaning: string
  fix: string
}

export interface DictionaryBase {
  id: string
  title: string
  summary: string
  endpoint: string
  domain: string | null
  operation: string | null
  geometry_types: string[]
  feature_rule: string
  columns: DictionaryColumn[]
  metadata_fields: DictionaryMetadataField[]
  metadata_example: Record<string, unknown>
  rules: string[]
  example_geojson: Record<string, unknown> | null
}

export interface DictionaryMaintainedBase {
  id: string
  title: string
  source: string
  refresh: string
  description: string
}

export interface DataDictionary {
  version: string
  formats: DictionaryFormat[]
  limits: DictionaryLimit[]
  crs: { canonical: string; metric: string; accepted: string; dimension: string }
  territory: { rule: string; bbox: number[]; description: string }
  geometry_repair: string
  bases: DictionaryBase[]
  maintained_bases: DictionaryMaintainedBase[]
  errors: DictionaryError[]
}

export function getDataDictionary(): Promise<DataDictionary> {
  return apiRequest<DataDictionary>("/data-dictionary")
}
