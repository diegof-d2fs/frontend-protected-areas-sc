export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  error_code: string
  correlation_id: string
  violations?: Record<string, unknown>[]
}

export class ApiError extends Error {
  readonly problem: ProblemDetail

  constructor(problem: ProblemDetail) {
    super(problem.detail)
    this.name = "ApiError"
    this.problem = problem
  }
}

function isProblemDetail(value: unknown): value is ProblemDetail {
  return (
    typeof value === "object" &&
    value !== null &&
    "error_code" in value &&
    "correlation_id" in value
  )
}

/**
 * Wrapper único de chamada à API: em toda resposta fora da faixa 2xx, tenta ler o corpo como
 * `problem+json` e lança um erro tipado com os campos exatos que o backend expõe (nunca um
 * detalhe de infraestrutura que não veio da própria resposta).
 */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, init)

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event("auth:unauthorized"))
    }
    const body: unknown = await response.json().catch(() => null)
    if (isProblemDetail(body)) {
      throw new ApiError(body)
    }
    throw new Error(`Falha inesperada ao falar com o servidor (HTTP ${response.status}).`)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
