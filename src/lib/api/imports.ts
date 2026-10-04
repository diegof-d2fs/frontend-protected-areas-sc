import { apiRequest } from "./client"

export type SubmissionStatus =
  | "RECEIVED"
  | "VALIDATING"
  | "ACCEPTED"
  | "REJECTED"
  | "DUPLICATE"
  | "PUBLISHED"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"

export type DuplicatePolicy = "reject_batch" | "skip_duplicates"

export interface SubmissionView {
  import_id: string
  status: SubmissionStatus
  domain: string
  operation: string
  duplicate_policy: DuplicatePolicy
  correlation_id: string
  original_filename: string
  size_bytes: number
  error_code: string | null
  error_detail: string | null
  duplicate_matches: Record<string, unknown>[]
  batch_items: Record<string, unknown>[]
  created_at: string
  updated_at: string
  links: Record<string, string>
}

export type ValidationSeverity = "error" | "warning"

export interface ValidationIssue {
  code: string
  message: string
  severity: ValidationSeverity
  feature: number | null
  field: string | null
  suggestion: string | null
}

export interface ValidationReport {
  valid: boolean
  detected_format: string | null
  source_crs: string | null
  target_crs: string
  geometry_types: string[]
  feature_count: number
  vertex_count: number
  bbox: number[] | null
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  repair_applied: boolean
}

export interface CreateUcImportInput {
  file: File
  source: string
  name?: string
  duplicatePolicy: DuplicatePolicy
  idempotencyKey: string
}

/**
 * Cadastro de UC (uma ou várias, conforme o arquivo) — o único caminho de escrita real da
 * interface hoje. Segue exatamente o multipart que a API espera: domínio e operação fixos,
 * metadados dentro de um único campo JSON, reparo de geometria sempre desligado nesta tela.
 */
export function createUcImport(input: CreateUcImportInput): Promise<SubmissionView> {
  const metadata: Record<string, string> = { source: input.source }
  if (input.name) {
    metadata.name = input.name
  }

  const body = new FormData()
  body.set("file", input.file)
  body.set("domain", "uc")
  body.set("operation", "create")
  body.set("duplicate_policy", input.duplicatePolicy)
  body.set("repair_geometry", "false")
  body.set("metadata", JSON.stringify(metadata))

  return apiRequest<SubmissionView>("/imports", {
    method: "POST",
    headers: {
      "Idempotency-Key": input.idempotencyKey,
      "X-Correlation-ID": crypto.randomUUID(),
    },
    body,
  })
}

export interface ReplaceBufferAbrangenciaImportInput {
  file: File
  source: string
  ucIdentifier: string
  reason: string
  validFrom?: string
  idempotencyKey: string
}

export interface UcSearchResult {
  id: number
  name: string
  status: "ATIVA" | "EXTINTA"
  geometry_version: number
  official_identifier: string | null
  cnuc_code: string | null
  wdpa_pid: string | null
  links: Record<string, string>
}

export type UcSearchFilter =
  | { type: "cd_cnuc"; value: string }
  | { type: "wdpa_pid"; value: string }

export function searchUcs(filter: UcSearchFilter): Promise<UcSearchResult[]> {
  const query = new URLSearchParams({ [filter.type]: filter.value })
  return apiRequest<UcSearchResult[]>(`/ucs?${query.toString()}`)
}

export interface UpdateUcImportInput {
  file: File
  source: string
  reason: string
  name?: string
  identifier: UcSearchFilter
  expectedVersion: number
  idempotencyKey: string
}

export function updateUcImport(input: UpdateUcImportInput): Promise<SubmissionView> {
  return versionedUcImport("update", input)
}

export function replacePointImport(input: UpdateUcImportInput): Promise<SubmissionView> {
  return versionedUcImport("replace_point", input)
}

function versionedUcImport(
  operation: "update" | "replace_point",
  input: UpdateUcImportInput,
): Promise<SubmissionView> {
  const metadata: Record<string, string | number> = {
    source: input.source,
    reason: input.reason,
    expected_version: input.expectedVersion,
    [input.identifier.type]: input.identifier.value,
  }
  if (input.name) metadata.name = input.name

  const body = new FormData()
  body.set("file", input.file)
  body.set("domain", "uc")
  body.set("operation", operation)
  body.set("repair_geometry", "false")
  body.set("metadata", JSON.stringify(metadata))

  return apiRequest<SubmissionView>("/imports", {
    method: "POST",
    headers: {
      "Idempotency-Key": input.idempotencyKey,
      "X-Correlation-ID": crypto.randomUUID(),
    },
    body,
  })
}

/**
 * Substituição do Buffer de Abrangência por ZA oficial (`UC-CW07`): domínio e operação fixos em
 * `za_oficial`/`replace_buffer_abrangencia`. Ao contrário de `uc/create`, não existe `duplicate_policy` nem
 * lote — o contrato exige exatamente uma feição Polygon/MultiPolygon e um identificador forte da
 * UC alvo, resolvido pelo Airflow, não pela API.
 */
export function replaceBufferAbrangenciaImport(input: ReplaceBufferAbrangenciaImportInput): Promise<SubmissionView> {
  const metadata: Record<string, string> = {
    source: input.source,
    uc_identifier: input.ucIdentifier,
    reason: input.reason,
  }
  if (input.validFrom) {
    metadata.valid_from = input.validFrom
  }

  const body = new FormData()
  body.set("file", input.file)
  body.set("domain", "za_oficial")
  body.set("operation", "replace_buffer_abrangencia")
  body.set("repair_geometry", "false")
  body.set("metadata", JSON.stringify(metadata))

  return apiRequest<SubmissionView>("/imports", {
    method: "POST",
    headers: {
      "Idempotency-Key": input.idempotencyKey,
      "X-Correlation-ID": crypto.randomUUID(),
    },
    body,
  })
}

export function getImport(importId: string): Promise<SubmissionView> {
  return apiRequest<SubmissionView>(`/imports/${importId}`)
}

export function getImportValidation(importId: string): Promise<ValidationReport> {
  return apiRequest<ValidationReport>(`/imports/${importId}/validation`)
}

export function publishImport(importId: string): Promise<SubmissionView> {
  return apiRequest<SubmissionView>(`/imports/${importId}/publish`, { method: "POST" })
}

/**
 * Tempo máximo de acompanhamento automático de uma importação publicada. O processamento é ligado
 * sob demanda: iniciar a máquina, subir o orquestrador e executar a cadeia de etapas leva minutos.
 * Na carga de referência medida na AWS, uma UC nova levou cerca de 29 minutos até o fim dos temas e
 * 71 minutos quando o MapBiomas gerou pela primeira vez a Silver de anos ainda ausentes; 90 minutos
 * cobrem os dois casos. A consulta espaça até 10 s, então o prazo maior custa poucas requisições.
 */
export const IMPORT_POLL_TIMEOUT_MS = 90 * 60 * 1000

export const TERMINAL_STATUSES: readonly SubmissionStatus[] = [
  "SUCCEEDED",
  "FAILED",
  "REJECTED",
  "DUPLICATE",
]
