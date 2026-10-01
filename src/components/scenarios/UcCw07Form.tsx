import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import {
  getImport,
  getImportValidation,
  IMPORT_POLL_TIMEOUT_MS,
  publishImport,
  replaceBufferAbrangenciaImport,
  TERMINAL_STATUSES,
  type SubmissionView,
  type ValidationReport,
} from "@/lib/api/imports"
import { translateErrorCode } from "@/lib/errorMessages"
import { localImportHistory } from "@/lib/history/localImportHistory"
import { SCENARIOS } from "@/lib/scenarios"
import { FileValidationSummary } from "./FileValidationSummary"
import { ImportStatusPanel } from "./ImportStatusPanel"

const SCENARIO = SCENARIOS.find((scenario) => scenario.id === "uc-cw07")!

const POLL_START_MS = 1500
const POLL_MAX_MS = 10_000

const formSchema = z.object({
  source: z.string().trim().min(1, "Informe a fonte dos dados."),
  ucIdentifier: z.string().trim().min(1, "Informe o identificador da UC."),
  reason: z.string().trim().min(1, "Informe a justificativa."),
  validFrom: z.string().trim().optional(),
})

type FormValues = z.infer<typeof formSchema>

/**
 * `UC-CW07`: substitui o Buffer de Abrangência ativo de uma UC pela ZA oficial recém-instituída. Sem
 * `duplicate_policy` (não existe lote nesta operação) e sem o campo Nome de `uc/create` —
 * `uc_identifier` já é a chave que o Airflow usa para localizar a UC, e a API não faz busca
 * prévia (SDD, seção 2.6, ainda pendente e necessária só para `UC-CW04`).
 */
export function UcCw07Form() {
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<SubmissionView | null>(null)
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null)
  const idempotencyKeyRef = useRef("")
  const pollStartedAtRef = useRef(0)
  const [pollTimedOut, setPollTimedOut] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { source: "", ucIdentifier: "", reason: "", validFrom: "" },
  })

  const createMutation = useMutation({
    mutationFn: replaceBufferAbrangenciaImport,
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
      toast.success("Importação publicada. Acompanhando o processamento.")
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.problem.error_code : null
      toast.error(translateErrorCode(code, error instanceof Error ? error.message : "Não foi possível publicar a importação."))
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
      if (query.state.status === "error") {
        return false
      }
      if (query.state.data && TERMINAL_STATUSES.includes(query.state.data.status)) {
        return false
      }
      const elapsed = Date.now() - pollStartedAtRef.current
      if (elapsed >= IMPORT_POLL_TIMEOUT_MS) {
        return false
      }
      return Math.min(POLL_START_MS + elapsed / 3, POLL_MAX_MS)
    },
  })

  const current = pollQuery.data ?? submission

  useEffect(() => {
    if (!current) return
    localImportHistory.record(SCENARIO.code, SCENARIO.title, current)
  }, [current])

  const notifiedTerminalRef = useRef<string | null>(null)
  useEffect(() => {
    if (!current || !TERMINAL_STATUSES.includes(current.status)) return
    const notificationKey = `${current.import_id}:${current.status}`
    if (notifiedTerminalRef.current === notificationKey) return
    notifiedTerminalRef.current = notificationKey

    if (current.status === "SUCCEEDED") {
      toast.success("ZA oficial ativada com sucesso.")
    } else if (current.status === "FAILED") {
      toast.error(translateErrorCode(current.error_code, "A importação falhou durante o processamento."))
    }
  }, [current])

  useEffect(() => {
    if (!isPolling || !current || TERMINAL_STATUSES.includes(current.status)) return
    const elapsed = pollQuery.dataUpdatedAt - pollStartedAtRef.current
    if (elapsed >= IMPORT_POLL_TIMEOUT_MS) {
      setPollTimedOut(true)
    }
  }, [isPolling, current, pollQuery.dataUpdatedAt])

  function onSubmit(values: FormValues) {
    if (!file) {
      setFileError("Selecione um arquivo.")
      return
    }
    setFileError(null)
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }
    createMutation.mutate({
      file,
      source: values.source,
      ucIdentifier: values.ucIdentifier,
      reason: values.reason,
      validFrom: values.validFrom || undefined,
      idempotencyKey: idempotencyKeyRef.current,
    })
  }

  function handleReset() {
    setFile(null)
    setSubmission(null)
    setValidationReport(null)
    setPollTimedOut(false)
    idempotencyKeyRef.current = ""
  }

  const showForm = current === null || current.status === "REJECTED"

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {current && <ImportStatusPanel status={current.status} />}

        {validationReport && <FileValidationSummary report={validationReport} />}

        {showForm && (
          // eslint-disable-next-line react-hooks/refs
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={!!fileError}>
                <FieldLabel htmlFor="file">Arquivo da ZA oficial</FieldLabel>
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
                <FieldDescription>Exatamente uma geometria Polygon ou MultiPolygon.</FieldDescription>
                <FieldError errors={fileError ? [{ message: fileError }] : undefined} />
              </Field>

              <Field data-invalid={!!errors.ucIdentifier}>
                <FieldLabel htmlFor="uc-identifier">Identificador da UC</FieldLabel>
                <Input
                  id="uc-identifier"
                  placeholder="CNUC, WDPA PID ou identificador oficial"
                  {...register("ucIdentifier")}
                />
                <FieldDescription>
                  A UC precisa já estar cadastrada e ter exatamente um Buffer de Abrangência ativo.
                </FieldDescription>
                <FieldError errors={errors.ucIdentifier ? [errors.ucIdentifier] : undefined} />
              </Field>

              <Field data-invalid={!!errors.source}>
                <FieldLabel htmlFor="source">Fonte</FieldLabel>
                <Input id="source" placeholder="Ex.: ICMBio, FATMA, levantamento de campo" {...register("source")} />
                <FieldError errors={errors.source ? [errors.source] : undefined} />
              </Field>

              <Field data-invalid={!!errors.reason}>
                <FieldLabel htmlFor="reason">Justificativa</FieldLabel>
                <Textarea id="reason" rows={3} {...register("reason")} />
                <FieldDescription>
                  Motivo da substituição, registrado na auditoria junto com ator, data e correlation ID.
                </FieldDescription>
                <FieldError errors={errors.reason ? [errors.reason] : undefined} />
              </Field>

              <Field>
                <FieldLabel htmlFor="valid-from">Início da vigência oficial (opcional)</FieldLabel>
                <Input id="valid-from" type="date" {...register("validFrom")} />
              </Field>

              <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                Validar arquivo
              </Button>
            </FieldGroup>
          </form>
        )}

        {current?.status === "ACCEPTED" && (
          <Button
            type="button"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
          >
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
          <p className="text-sm text-success">ZA oficial ativada e Buffer de Abrangência anterior preservado como histórico.</p>
        )}
        {current?.status === "FAILED" && (
          <p className="text-sm text-destructive">
            {translateErrorCode(current.error_code, current.error_detail ?? "A importação falhou.")}
          </p>
        )}
      </CardContent>
      {current && (
        <CardFooter>
          <Button type="button" variant="outline" onClick={handleReset}>
            Selecionar outro arquivo
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
