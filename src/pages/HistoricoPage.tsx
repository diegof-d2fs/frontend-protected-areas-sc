import { useInfiniteQuery, useQueries } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getImport,
  listMyImports,
  TERMINAL_STATUSES,
  type ImportHistoryScope,
  type SubmissionStatus,
  type SubmissionView,
} from "@/lib/api/imports"
import { useAuth } from "@/context/AuthContext"
import { scenarioForSubmission } from "@/lib/history/scenarioForSubmission"

const PAGE_SIZE = 50

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  RECEIVED: "Enviado",
  VALIDATING: "Validando",
  ACCEPTED: "Validado",
  REJECTED: "Rejeitado",
  DUPLICATE: "Duplicado",
  PUBLISHED: "Publicado",
  PROCESSING: "Processando",
  SUCCEEDED: "Concluído",
  FAILED: "Falhou",
}

function statusBadgeVariant(status: SubmissionStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCEEDED") return "default"
  if (status === "FAILED" || status === "REJECTED") return "destructive"
  if (status === "DUPLICATE") return "outline"
  return "secondary"
}

export function HistoricoPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [scope, setScope] = useState<ImportHistoryScope>("mine")
  const showAll = isAdmin && scope === "all"
  const history = useInfiniteQuery({
    queryKey: ["import-history", showAll ? "all" : "mine"],
    queryFn: ({ pageParam }) => listMyImports(PAGE_SIZE, pageParam, showAll ? "all" : "mine"),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.offset + lastPage.limit : undefined),
  })
  const listed: SubmissionView[] = history.data?.pages.flatMap((page) => page.items) ?? []

  // A listagem devolve o estado gravado na última consulta; quem avança uma importação em
  // andamento para o estado do Airflow é a consulta individual. Por isso cada linha ainda não
  // terminal é acompanhada por ela, com a mesma chave de cache da tela de detalhe.
  const pendingIds = listed
    .filter((item) => !TERMINAL_STATUSES.includes(item.status))
    .map((item) => item.import_id)
  const pendingQueries = useQueries({
    queries: pendingIds.map((importId) => ({
      queryKey: ["import", importId],
      queryFn: () => getImport(importId),
      refetchInterval: (query: { state: { status: string; data?: SubmissionView } }) =>
        query.state.status === "error" ||
        (query.state.data && TERMINAL_STATUSES.includes(query.state.data.status))
          ? false
          : 5000,
    })),
  })
  const fresh = new Map(
    pendingQueries.flatMap((query) => (query.data ? [[query.data.import_id, query.data] as const] : [])),
  )
  const entries = listed.map((item) => fresh.get(item.import_id) ?? item)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          {showAll
            ? "Importações de todas as contas, da mais recente para a mais antiga."
            : "Importações enviadas com a sua conta, da mais recente para a mais antiga."}
        </p>
      </div>

      {isAdmin && (
        <div className="flex gap-2" role="group" aria-label="Contas exibidas">
          <Button
            type="button"
            size="sm"
            variant={showAll ? "outline" : "default"}
            aria-pressed={!showAll}
            onClick={() => setScope("mine")}
          >
            Minhas
          </Button>
          <Button
            type="button"
            size="sm"
            variant={showAll ? "default" : "outline"}
            aria-pressed={showAll}
            onClick={() => setScope("all")}
          >
            Todas as contas
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Importações</CardTitle>
          <CardDescription>Clique numa linha para ver o acompanhamento completo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {history.isPending ? (
            <div className="flex flex-col gap-2" aria-label="Carregando histórico">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : history.isError ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => history.refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma importação enviada ainda.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cenário</TableHead>
                    <TableHead>Arquivo</TableHead>
                    {showAll && <TableHead>Enviado por</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Enviado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((submission) => {
                    const scenario = scenarioForSubmission(submission)
                    return (
                      <TableRow
                        key={submission.import_id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/historico/${submission.import_id}`)}
                      >
                        <TableCell className="whitespace-normal">
                          <span className="font-mono text-xs text-muted-foreground">{scenario.code}</span>{" "}
                          {scenario.title}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-normal break-all">
                          {submission.original_filename}
                        </TableCell>
                        {showAll && (
                          <TableCell className="whitespace-normal text-sm">
                            {submission.submitted_by ?? "—"}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={statusBadgeVariant(submission.status)}>
                            {STATUS_LABEL[submission.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(submission.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {history.hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  className="self-center"
                  disabled={history.isFetchingNextPage}
                  onClick={() => history.fetchNextPage()}
                >
                  {history.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
