import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { apiRequest } from "@/lib/api/client"
import { getImport, publishImport, searchUcs, TERMINAL_STATUSES, type SubmissionView, type UcSearchResult } from "@/lib/api/imports"
import { localImportHistory } from "@/lib/history/localImportHistory"
import { ImportStatusPanel } from "./ImportStatusPanel"

export function UcCw05Form() {
  const [identifier, setIdentifier] = useState("")
  const [kind, setKind] = useState<"cd_cnuc" | "wdpa_pid">("cd_cnuc")
  const [target, setTarget] = useState<UcSearchResult | null>(null)
  const [source, setSource] = useState("")
  const [reason, setReason] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submission, setSubmission] = useState<SubmissionView | null>(null)
  const [key, setKey] = useState(() => crypto.randomUUID())
  const poll = useQuery({
    queryKey: ["import", submission?.import_id],
    queryFn: () => getImport(submission!.import_id),
    enabled: !!submission && !TERMINAL_STATUSES.includes(submission.status) && submission.status !== "ACCEPTED",
    refetchInterval: (query) => query.state.data && TERMINAL_STATUSES.includes(query.state.data.status) ? false : 5000,
  })
  const current = poll.data ?? submission
  useEffect(() => {
    if (current) localImportHistory.record("UC-CW05", "Extinguir unidade de conservação", current)
  }, [current])

  async function search() {
    setBusy(true)
    setTarget(null)
    setConfirmed(false)
    setKey(crypto.randomUUID())
    try {
      const results = await searchUcs({ type: kind, value: identifier.trim() })
      setTarget(results[0] ?? null)
      if (!results.length) toast.error("UC não encontrada.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na busca.")
    } finally { setBusy(false) }
  }

  async function submit() {
    if (!target || !confirmed) return
    setBusy(true)
    try {
      const created = submission ?? await apiRequest<SubmissionView>(`/ucs/${target.id}/extinguish`, {
        method: "POST",
        headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ expected_version: target.geometry_version, source, reason }),
      })
      setSubmission(created)
      if (created.status === "ACCEPTED") setSubmission(await publishImport(created.import_id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao solicitar extinção.")
    } finally { setBusy(false) }
  }

  return <div className="flex max-w-2xl flex-col gap-4 rounded-lg border p-5">
    {!submission && <>
      <label htmlFor="extinction-kind">Tipo de identificador</label>
      <select id="extinction-kind" className="rounded border p-2" value={kind}
        onChange={(event) => { setKind(event.target.value as typeof kind); setTarget(null); setConfirmed(false) }}>
        <option value="cd_cnuc">Código CNUC</option><option value="wdpa_pid">WDPA PID</option>
      </select>
      <label htmlFor="extinction-id">Identificador da UC</label>
      <Input id="extinction-id" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setTarget(null); setConfirmed(false) }} />
      <Button onClick={search} disabled={busy || !identifier.trim()}>Buscar UC</Button>
      {target && <p>{target.name} · {target.status} · Versão {target.geometry_version}</p>}
      <label htmlFor="extinction-source">Fonte do ato de extinção</label>
      <Input id="extinction-source" value={source} onChange={(event) => { setSource(event.target.value); setKey(crypto.randomUUID()) }} />
      <label htmlFor="extinction-reason">Justificativa</label>
      <Textarea id="extinction-reason" value={reason} onChange={(event) => { setReason(event.target.value); setKey(crypto.randomUUID()) }} />
      <label className="flex gap-2">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        Confirmo a extinção desta UC. O histórico será preservado e novos cruzamentos serão bloqueados.
      </label>
    </>}
    {current && <ImportStatusPanel status={current.status} />}
    {(!submission || submission.status === "ACCEPTED") &&
      <Button variant="destructive" onClick={submit}
        disabled={busy || !confirmed || target?.status !== "ATIVA" || !source.trim() || !reason.trim()}>
        {busy ? "Enviando…" : "Confirmar extinção"}
      </Button>}
    {current?.status === "SUCCEEDED" && <p>Extinção concluída. Histórico preservado.</p>}
    {current?.status === "FAILED" && <p role="alert">{current.error_detail ?? "A extinção falhou."}</p>}
  </div>
}
