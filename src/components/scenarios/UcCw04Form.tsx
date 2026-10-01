import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import {
  getImport,
  getImportValidation,
  IMPORT_POLL_TIMEOUT_MS,
  publishImport,
  replacePointImport,
  searchUcs,
  TERMINAL_STATUSES,
  updateUcImport,
  type SubmissionView,
  type UcSearchFilter,
  type UcSearchResult,
  type ValidationReport,
} from "@/lib/api/imports"
import { translateErrorCode } from "@/lib/errorMessages"
import { localImportHistory } from "@/lib/history/localImportHistory"
import { SCENARIOS } from "@/lib/scenarios"
import { FileValidationSummary } from "./FileValidationSummary"
import { ImportStatusPanel } from "./ImportStatusPanel"

const POLL_START_MS = 1500
const POLL_MAX_MS = 10_000

const formSchema = z.object({
  identifierType: z.enum(["cd_cnuc", "wdpa_pid"]),
  identifier: z.string().trim().min(1, "Informe o identificador da UC."),
  source: z.string().trim().min(1, "Informe a fonte dos dados."),
  reason: z.string().trim().min(1, "Informe a justificativa."),
})

type FormValues = z.infer<typeof formSchema>
type SelectedTarget = { result: UcSearchResult; identifier: UcSearchFilter }

interface UcCw04FormProps {
  operation?: "update" | "replace_point"
}

export function UcCw04Form({ operation = "update" }: UcCw04FormProps) {
  const isReplacePoint = operation === "replace_point"
  const scenario = SCENARIOS.find((item) => item.id === (isReplacePoint ? "uc-cw06" : "uc-cw04"))!
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [target, setTarget] = useState<SelectedTarget | null>(null)
  const [submission, setSubmission] = useState<SubmissionView | null>(null)
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const idempotencyKeyRef = useRef("")
  const pollStartedAtRef = useRef(0)

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { identifierType: "cd_cnuc", identifier: "", source: "", reason: "" },
  })

  const identifierType = useWatch({ control, name: "identifierType" })
  const identifier = useWatch({ control, name: "identifier" })
  const selectedTarget =
    target && target.identifier.type === identifierType && target.identifier.value === identifier.trim()
      ? target
      : null

  const searchMutation = useMutation({
    mutationFn: searchUcs,
    onSuccess: (results, filter) => {
      if (results.length === 0) {
        setTarget(null)
        toast.error("Nenhuma unidade de conservação foi encontrada com esse identificador.")
        return
      }
      setTarget({ result: results[0], identifier: filter })
      toast.success("UC encontrada. A versão vigente foi preenchida automaticamente.")
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.problem.error_code : null
      toast.error(translateErrorCode(code, error instanceof Error ? error.message : "Não foi possível buscar a UC."))
    },
  })

  const createMutation = useMutation({
    mutationFn: isReplacePoint ? replacePointImport : updateUcImport,
    onSuccess: async (result) => {
      setSubmission(result)
      const report = await getImportValidation(result.import_id).catch(() => null)
      setValidationReport(report)
      if (result.status === "ACCEPTED") {
        toast.success("Arquivo validado. Confira o resumo antes de iniciar o processamento.")
      } else if (result.status === "REJECTED") {
        toast.error("O arquivo não passou na validação. Veja os detalhes abaixo.")
      }
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.problem.error_code : null
      toast.error(translateErrorCode(code, error instanceof Error ? error.message : "Não foi possível validar o arquivo."))
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => publishImport(submission!.import_id),
    onSuccess: (result) => {
      setSubmission(result)
      pollStartedAtRef.current = Date.now()
      setPollTimedOut(false)
      toast.success("Atualização publicada. Acompanhando o processamento.")
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.problem.error_code : null
      toast.error(translateErrorCode(code, error instanceof Error ? error.message : "Não foi possível publicar a atualização."))
    },
  })

  const isPolling =
    submission !== null &&
    (submission.status === "PUBLISHED" || submission.status === "PROCESSING")

  const pollQuery = useQuery({
    queryKey: ["import", submission?.import_id],
    queryFn: () => getImport(submission!.import_id),
    enabled: isPolling,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false
      if (query.state.data && TERMINAL_STATUSES.includes(query.state.data.status)) return false
      const elapsed = Date.now() - pollStartedAtRef.current
      if (elapsed >= IMPORT_POLL_TIMEOUT_MS) return false
      return Math.min(POLL_START_MS + elapsed / 3, POLL_MAX_MS)
    },
  })

  const current = pollQuery.data ?? submission

  useEffect(() => {
    if (!current) return
    localImportHistory.record(scenario.code, scenario.title, current)
  }, [current, scenario.code, scenario.title])

  const notifiedTerminalRef = useRef<string | null>(null)
  useEffect(() => {
    if (!current || !TERMINAL_STATUSES.includes(current.status)) return
    const notificationKey = `${current.import_id}:${current.status}`
    if (notifiedTerminalRef.current === notificationKey) return
    notifiedTerminalRef.current = notificationKey
    if (current.status === "SUCCEEDED") {
      toast.success("Unidade de conservação atualizada com sucesso.")
    } else if (current.status === "FAILED") {
      toast.error(translateErrorCode(current.error_code, "A atualização falhou durante o processamento."))
    }
  }, [current])

  useEffect(() => {
    if (!isPolling || !current || TERMINAL_STATUSES.includes(current.status)) return
    const elapsed = pollQuery.dataUpdatedAt - pollStartedAtRef.current
    if (elapsed >= IMPORT_POLL_TIMEOUT_MS) setPollTimedOut(true)
  }, [isPolling, current, pollQuery.dataUpdatedAt])

  function handleSearch() {
    const type = getValues("identifierType")
    const value = getValues("identifier").trim()
    if (!value) {
      setError("identifier", { message: "Informe o identificador da UC." })
      return
    }
    clearErrors("identifier")
    const filter: UcSearchFilter =
      type === "cd_cnuc" ? { type: "cd_cnuc", value } : { type: "wdpa_pid", value }
    searchMutation.mutate(filter)
  }

  function onSubmit(values: FormValues) {
    if (!selectedTarget) {
      setError("identifier", { message: "Busque e confirme a UC antes de enviar." })
      return
    }
    if (selectedTarget.result.status !== "ATIVA") {
      toast.error("Uma UC extinta não pode receber atualização cadastral.")
      return
    }
    if (!file) {
      setFileError("Selecione um arquivo.")
      return
    }
    setFileError(null)
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID()
    createMutation.mutate({
      file,
      source: values.source,
      reason: values.reason,
      name: selectedTarget.result.name,
      identifier: selectedTarget.identifier,
      expectedVersion: selectedTarget.result.geometry_version,
      idempotencyKey: idempotencyKeyRef.current,
    })
  }

  function handleReset() {
    setFile(null)
    setFileError(null)
    setTarget(null)
    setSubmission(null)
    setValidationReport(null)
    setPollTimedOut(false)
    idempotencyKeyRef.current = ""
    reset()
  }

  const showForm = current === null || current.status === "REJECTED"

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {current && <ImportStatusPanel status={current.status} />}
        {validationReport && <FileValidationSummary report={validationReport} />}

        {showForm && (
          // react-hook-form's `handleSubmit` invokes `onSubmit` only for the submit event;
          // the idempotency ref is not read while React renders this element.
          // eslint-disable-next-line react-hooks/refs
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FieldGroup>
              <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                <Field>
                  <FieldLabel htmlFor="identifier-type">Tipo de identificador</FieldLabel>
                  <Controller
                    name="identifierType"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="identifier-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cd_cnuc">Código CNUC</SelectItem>
                          <SelectItem value="wdpa_pid">WDPA PID</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field data-invalid={!!errors.identifier}>
                  <FieldLabel htmlFor="uc-identifier">Identificador da UC</FieldLabel>
                  <Input id="uc-identifier" {...register("identifier")} />
                  <FieldError errors={errors.identifier ? [errors.identifier] : undefined} />
                </Field>
                <Button type="button" variant="outline" onClick={handleSearch} disabled={searchMutation.isPending}>
                  {searchMutation.isPending ? "Buscando…" : "Buscar UC"}
                </Button>
              </div>

              {selectedTarget && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{selectedTarget.result.name}</p>
                  <p className="text-muted-foreground">
                    Versão vigente: {selectedTarget.result.geometry_version} · Situação: {selectedTarget.result.status}
                  </p>
                </div>
              )}

              <Field data-invalid={!!fileError}>
                <FieldLabel htmlFor="file">
                  {isReplacePoint ? "Limite poligonal oficial da UC" : "Nova geometria da UC"}
                </FieldLabel>
                <Input
                  id="file"
                  type="file"
                  accept=".zip,.geojson,.json,.kml"
                  className="cursor-pointer file:cursor-pointer"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null)
                    setFileError(null)
                  }}
                />
                <FieldDescription>
                  {isReplacePoint
                    ? "Exatamente uma geometria Polygon ou MultiPolygon; a UC vigente deve ser pontual."
                    : "Exatamente uma geometria Point, Polygon ou MultiPolygon."}
                </FieldDescription>
                <FieldError errors={fileError ? [{ message: fileError }] : undefined} />
              </Field>

              <Field data-invalid={!!errors.source}>
                <FieldLabel htmlFor="source">Fonte</FieldLabel>
                <Input id="source" placeholder="Ex.: ICMBio, IMA/SC, levantamento de campo" {...register("source")} />
                <FieldError errors={errors.source ? [errors.source] : undefined} />
              </Field>

              <Field data-invalid={!!errors.reason}>
                <FieldLabel htmlFor="reason">Justificativa</FieldLabel>
                <Textarea id="reason" rows={3} {...register("reason")} />
                <FieldDescription>
                  A versão encontrada é enviada automaticamente para impedir sobrescrita concorrente.
                </FieldDescription>
                <FieldError errors={errors.reason ? [errors.reason] : undefined} />
              </Field>

              <Button type="submit" disabled={isSubmitting || createMutation.isPending || !selectedTarget}>
                {isReplacePoint ? "Validar substituição" : "Validar atualização"}
              </Button>
            </FieldGroup>
          </form>
        )}

        {current?.status === "ACCEPTED" && (
          <Button type="button" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            Iniciar processamento
          </Button>
        )}

        {pollTimedOut && (
          <div className="flex items-center justify-between rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
            <span>O processamento ainda não terminou. Confira o histórico mais tarde ou atualize agora.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                pollStartedAtRef.current = Date.now()
                setPollTimedOut(false)
                pollQuery.refetch()
              }}
            >
              Atualizar agora
            </Button>
          </div>
        )}

        {current?.status === "SUCCEEDED" && (
          <p className="text-sm text-success">
            {isReplacePoint
              ? "Ponto substituído pelo polígono; histórico preservado e Buffer de Abrangência reprocessado."
              : "UC atualizada com histórico e versão anterior preservados."}
          </p>
        )}
        {current?.status === "FAILED" && (
          <p className="text-sm text-destructive">
            {translateErrorCode(current.error_code, current.error_detail ?? "A atualização falhou.")}
          </p>
        )}
      </CardContent>
      {current && (
        <CardFooter>
          <Button type="button" variant="outline" onClick={handleReset}>Selecionar outro arquivo</Button>
        </CardFooter>
      )}
    </Card>
  )
}
