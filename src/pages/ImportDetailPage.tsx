import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { Navigate, Link, useParams } from "react-router-dom"
import { FileValidationSummary } from "@/components/scenarios/FileValidationSummary"
import { ImportStatusPanel } from "@/components/scenarios/ImportStatusPanel"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError } from "@/lib/api/client"
import { getImport, getImportValidation, TERMINAL_STATUSES } from "@/lib/api/imports"
import { localImportHistory } from "@/lib/history/localImportHistory"
import { translateErrorCode } from "@/lib/errorMessages"

const POLL_START_MS = 1500
const POLL_MAX_MS = 10_000

export function ImportDetailPage() {
  const { importId } = useParams<{ importId: string }>()
  const historyEntry = importId ? localImportHistory.get(importId) : undefined

  const importQuery = useQuery({
    queryKey: ["import", importId],
    queryFn: () => getImport(importId!),
    enabled: !!importId,
    // Um import_id que não existe (URL digitada errada, ou de outra sessão) nunca vai deixar
    // de dar 404 — tentar de novo só atrasa mostrar isso para a pessoa.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.problem.status === 404 ? false : failureCount < 2,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false
      if (query.state.data && TERMINAL_STATUSES.includes(query.state.data.status)) return false
      return Math.min(POLL_START_MS + (Date.now() % POLL_MAX_MS), POLL_MAX_MS)
    },
  })

  const validationQuery = useQuery({
    queryKey: ["import-validation", importId],
    queryFn: () => getImportValidation(importId!),
    enabled: !!importId && !!importQuery.data,
    retry: false,
  })

  if (!importId) {
    return <Navigate to="/historico" replace />
  }

  const submission = importQuery.data

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/historico"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Todo o histórico
      </Link>

      <div>
        {historyEntry && (
          <span className="font-mono text-xs text-muted-foreground">{historyEntry.scenarioCode}</span>
        )}
        <h1 className="text-lg font-semibold text-foreground">
          {historyEntry?.scenarioTitle ?? "Importação"}
        </h1>
        {submission && (
          <p className="font-mono text-xs text-muted-foreground">{submission.original_filename}</p>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          {submission ? (
            <>
              <ImportStatusPanel status={submission.status} />
              {validationQuery.data && <FileValidationSummary report={validationQuery.data} />}
              {submission.status === "FAILED" && (
                <p className="text-sm text-destructive">
                  {translateErrorCode(submission.error_code, submission.error_detail ?? "A importação falhou.")}
                </p>
              )}
            </>
          ) : importQuery.isError ? (
            <p className="text-sm text-destructive">
              {importQuery.error instanceof ApiError && importQuery.error.problem.status === 404
                ? "Essa importação não existe ou já não está mais disponível."
                : "Não foi possível carregar essa importação agora."}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
