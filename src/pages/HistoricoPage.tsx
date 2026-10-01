import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { localImportHistory } from "@/lib/history/localImportHistory"
import { getImport, TERMINAL_STATUSES, type SubmissionStatus } from "@/lib/api/imports"

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
  const queryClient = useQueryClient()
  const { data: entries } = useQuery({
    queryKey: ["import-history"],
    queryFn: () => localImportHistory.list(),
  })

  // A lista guardada localmente só se atualiza sozinha enquanto a tela que disparou a
  // importação (o formulário do cenário) continua montada. Quem está só olhando o histórico
  // busca o estado atual de cada importação ainda não terminal diretamente na API, para nunca
  // mostrar aqui um status mais antigo do que o que a própria API já tem.
  const pendingIds = (entries ?? [])
    .filter((entry) => !TERMINAL_STATUSES.includes(entry.submission.status))
    .map((entry) => entry.submission.import_id)

  const pendingQueries = useQueries({
    queries: pendingIds.map((importId) => ({
      queryKey: ["import", importId],
      queryFn: () => getImport(importId),
      refetchInterval: (query: { state: { status: string } }) =>
        query.state.status === "error" ? false : 3000,
    })),
  })

  useEffect(() => {
    let changed = false
    for (const query of pendingQueries) {
      if (!query.data) continue
      const entry = localImportHistory.get(query.data.import_id)
      if (entry && entry.submission.status !== query.data.status) {
        localImportHistory.record(entry.scenarioCode, entry.scenarioTitle, query.data)
        changed = true
      }
    }
    if (changed) {
      queryClient.invalidateQueries({ queryKey: ["import-history"] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQueries.map((q) => q.dataUpdatedAt).join(",")])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          Importações executadas nesta navegação, da mais recente para a mais antiga.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Importações</CardTitle>
          <CardDescription>Clique numa linha para ver o acompanhamento completo.</CardDescription>
        </CardHeader>
        <CardContent>
          {!entries || entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma importação enviada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cenário</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualizado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(({ scenarioCode, scenarioTitle, submission }) => (
                  <TableRow
                    key={submission.import_id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/historico/${submission.import_id}`)}
                  >
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{scenarioCode}</span>{" "}
                      {scenarioTitle}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{submission.original_filename}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(submission.status)}>
                        {STATUS_LABEL[submission.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(submission.updated_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
