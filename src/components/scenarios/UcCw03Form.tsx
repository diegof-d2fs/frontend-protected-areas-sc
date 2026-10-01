import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiRequest } from "@/lib/api/client"
import { TERMINAL_STATUSES, type SubmissionView } from "@/lib/api/imports"
import { localImportHistory } from "@/lib/history/localImportHistory"
import { ImportStatusPanel } from "./ImportStatusPanel"

interface BatchView extends SubmissionView { batch_id: string }

export function UcCw03Form() {
  const [ucFile, setUcFile] = useState<File | null>(null)
  const [zoneFile, setZoneFile] = useState<File | null>(null)
  const [identifier, setIdentifier] = useState("")
  const [name, setName] = useState("")
  const [source, setSource] = useState("")
  const [busy, setBusy] = useState(false)
  const [batch, setBatch] = useState<BatchView | null>(null)
  const [key, setKey] = useState(() => crypto.randomUUID())
  const poll = useQuery({
    queryKey: ["batch", batch?.batch_id],
    queryFn: () => apiRequest<BatchView>(`/import-batches/${batch!.batch_id}`),
    enabled: !!batch && batch.status !== "ACCEPTED" && !TERMINAL_STATUSES.includes(batch.status),
    refetchInterval: (query) => query.state.data && TERMINAL_STATUSES.includes(query.state.data.status) ? false : 5000,
  })
  const current = poll.data ?? batch
  useEffect(() => {
    if (current) localImportHistory.record("UC-CW03", "Cadastrar UC com ZA oficial", current)
  }, [current])

  async function validate() {
    if (!ucFile || !zoneFile) return
    setBusy(true)
    try {
      const upload = async (file: File, domain: string, metadata: Record<string, string>, suffix: string) => {
        const body = new FormData()
        body.set("file", file)
        body.set("domain", domain)
        body.set("operation", "create")
        body.set("metadata", JSON.stringify(metadata))
        const result = await apiRequest<SubmissionView>("/imports", {
          method: "POST", headers: { "Idempotency-Key": key + suffix }, body,
        })
        if (result.status !== "ACCEPTED") throw new Error(`O arquivo ${file.name} foi rejeitado. Confira geometria e metadados.`)
        return result
      }
      const uc = await upload(ucFile, "uc", { source, name, official_identifier: identifier }, "-uc")
      const za = await upload(zoneFile, "za_oficial", { source, uc_identifier: identifier }, "-za")
      const result = await apiRequest<BatchView>("/import-batches", {
        method: "POST", headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ uc_import_id: uc.import_id, official_zone_import_id: za.import_id }),
      })
      setBatch(result)
      toast.success("Os dois arquivos foram validados e agrupados.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na validação.")
    } finally { setBusy(false) }
  }

  async function publish() {
    setBusy(true)
    try {
      setBatch(await apiRequest<BatchView>(`/import-batches/${batch!.batch_id}/publish`, { method: "POST" }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na publicação.")
    } finally { setBusy(false) }
  }

  function changed() { setKey(crypto.randomUUID()) }

  return <div className="flex max-w-2xl flex-col gap-4 rounded-lg border p-5">
    {!batch && <>
      <label htmlFor="batch-name">Nome da UC</label>
      <Input id="batch-name" value={name} onChange={(e) => { setName(e.target.value); changed() }} />
      <label htmlFor="batch-id">Identificador oficial da UC</label>
      <Input id="batch-id" value={identifier} maxLength={50} onChange={(e) => { setIdentifier(e.target.value); changed() }} />
      <label htmlFor="batch-source">Fonte dos dados</label>
      <Input id="batch-source" value={source} onChange={(e) => { setSource(e.target.value); changed() }} />
      <label htmlFor="batch-uc">Arquivo da UC (uma feição)</label>
      <Input id="batch-uc" type="file" accept=".zip,.geojson,.json,.kml"
        onChange={(e) => { setUcFile(e.target.files?.[0] ?? null); changed() }} />
      <label htmlFor="batch-za">Arquivo da ZA oficial (um polígono)</label>
      <Input id="batch-za" type="file" accept=".zip,.geojson,.json,.kml"
        onChange={(e) => { setZoneFile(e.target.files?.[0] ?? null); changed() }} />
      <p className="text-sm text-muted-foreground">UC e ZA serão cadastradas juntas. Se uma delas falhar na gravação, nenhuma será cadastrada.</p>
      <Button onClick={validate} disabled={busy || !ucFile || !zoneFile || !identifier.trim() || !name.trim() || !source.trim()}>
        {busy ? "Validando…" : "Validar arquivos"}
      </Button>
    </>}
    {current && <ImportStatusPanel status={current.status} />}
    {current?.status === "ACCEPTED" && <Button onClick={publish} disabled={busy}>Cadastrar UC e ZA oficial</Button>}
    {current?.status === "SUCCEEDED" && <p>UC e ZA oficial cadastradas com sucesso.</p>}
    {current?.status === "FAILED" && <p role="alert">{current.error_detail ?? "O processamento falhou."}</p>}
  </div>
}
