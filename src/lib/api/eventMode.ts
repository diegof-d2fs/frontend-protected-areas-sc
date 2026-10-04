import { apiRequest } from "@/lib/api/client"

// Espelho do contrato de `/api/v1/admin/event-mode` (somente administrador).

export type EventStatus =
  | "agendado"
  | "ativando"
  | "ativo"
  | "desativando"
  | "encerrado"
  | "cancelado"
  | "falhou"

export interface EventView {
  id: number
  nome: string
  status: EventStatus
  db_login: string
  starts_at: string
  auto_return_at: string
  activated_at: string | null
  deactivate_allowed_at: string | null
  finished_at: string | null
  current_step: string | null
  failure_message: string | null
  execution_url: string | null
  requested_by_name: string
  created_at: string
  estimated_cost_usd: number
}

export interface EventModeRules {
  normal_instance_type: string
  event_instance_type: string
  min_active_minutes: number
  default_duration_hours: number
  max_duration_hours: number
  extra_cost_usd_per_hour: number
  estimated_activation_minutes: string
  estimated_downtime_minutes: string
  estimated_full_performance_minutes: string
  recommended_lead_minutes: number
}

export interface EventModeState {
  configured: boolean
  server_time: string
  rules: EventModeRules
  current: EventView | null
}

export interface EventCredentials {
  db_login: string
  db_password: string
  db_host: string
  db_name: string
  db_port: number
  ogc_base_url: string
}

const JSON_HEADERS = { "Content-Type": "application/json" }

export function getEventMode(): Promise<EventModeState> {
  return apiRequest<EventModeState>("/admin/event-mode")
}

export function getEventHistory(): Promise<EventView[]> {
  return apiRequest<EventView[]>("/admin/event-mode/history")
}

export function activateEventMode(input: {
  nome: string
  inicio: string | null
  retornoAutomaticoEm: string
  idempotencyKey: string
}): Promise<EventView> {
  return apiRequest<EventView>("/admin/event-mode", {
    method: "POST",
    headers: { ...JSON_HEADERS, "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      nome: input.nome.trim(),
      inicio: input.inicio,
      retorno_automatico_em: input.retornoAutomaticoEm,
      confirmacao: "ATIVAR",
    }),
  })
}

export function extendEventMode(id: number, retornoAutomaticoEm: string): Promise<EventView> {
  return apiRequest<EventView>(`/admin/event-mode/${id}/extend`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ retorno_automatico_em: retornoAutomaticoEm }),
  })
}

export function deactivateEventMode(id: number): Promise<EventView> {
  return apiRequest<EventView>(`/admin/event-mode/${id}/deactivate`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ confirmacao: "DESATIVAR" }),
  })
}

export function cancelEventMode(id: number): Promise<EventView> {
  return apiRequest<EventView>(`/admin/event-mode/${id}/cancel`, { method: "POST" })
}

export function getEventCredentials(id: number): Promise<EventCredentials> {
  return apiRequest<EventCredentials>(`/admin/event-mode/${id}/credentials`)
}
