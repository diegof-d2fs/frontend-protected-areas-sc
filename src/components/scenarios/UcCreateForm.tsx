import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApiError } from "@/lib/api/client"
import {
  createUcImport,
  getImport,
  getImportValidation,
  IMPORT_POLL_TIMEOUT_MS,
  publishImport,
  TERMINAL_STATUSES,
  type SubmissionView,
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
  source: z.string().trim().min(1, "Informe a fonte dos dados."),
  duplicatePolicy: z.enum(["reject_batch", "skip_duplicates"]),
  name: z.string().trim().optional(),
})

type FormValues = z.infer<typeof formSchema>

/**
 * Formulário de `uc/create`, compartilhado por `UC-CW01` (polígono) e `UC-CW02` (ponto): o
 * contrato da API é o mesmo lote de uma ou várias features para as duas operações — só o motivo
 * do cartão na grade de cenários muda o tipo de geometria esperado, a API valida isso sozinha.
 * `scenarioId` decide só qual cenário fica registrado no histórico local desta importação.
 */
export function UcCreateForm({ scenarioId }: { scenarioId: string }) {
  const scenario = SCENARIOS.find((item) => item.id === scenarioId)!

  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<SubmissionView | null>(null)
  const [needsName, setNeedsName] = useState(false)
  // Preenchido tanto num arquivo válido (contagem de feições, tipos de geometria, CRS — a
  // pré-visualização que ajuda a notar uma inconsistência antes de iniciar o processamento)
  // quanto num arquivo rejeitado (a lista de erros já vem no mesmo relatório).
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null)
  // Gerados fora do render (no primeiro envio e quando o polling é iniciado) — nunca na
  // inicialização do ref, que roda durante o render e precisa ficar livre de efeito colateral.
  const idempotencyKeyRef = useRef("")
  const pollStartedAtRef = useRef(0)
  const [pollTimedOut, setPollTimedOut] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { source: "", duplicatePolicy: "reject_batch", name: "" },
  })

  const createMutation = useMutation({
    mutationFn: createUcImport,
    onSuccess: async (result) => {
      setSubmission(result)
      const report = await getImportValidation(result.import_id).catch(() => null)
      setValidationReport(report)

      if (result.status === "ACCEPTED") {
        toast.success("Arquivo validado. Confira o resumo antes de iniciar o processamento.")
      } else if (result.status === "REJECTED") {
        if (report?.errors.some((issue) => issue.code === "MISSING_UC_NAME")) {
          setNeedsName(true)
          idempotencyKeyRef.current = crypto.randomUUID()
          toast.error(translateErrorCode("MISSING_UC_NAME", "Corrija os dados e envie novamente."))
        } else {
          toast.error("O arquivo não passou na validação. Veja os detalhes abaixo.")
        }
      } else if (result.status === "DUPLICATE") {
        toast.error(translateErrorCode("DUPLICATE", "Essa importação já existe."))
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
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar a importação.")
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

  // O estado mostrado na tela é sempre o resultado mais recente do polling quando ele está
  // ativo; `submission` só existe para guardar o resultado do envio/publicação entre as
  // chamadas e sobreviver depois que o polling para.
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
      toast.success("Importação concluída com sucesso.")
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
      name: needsName ? values.name : undefined,
      duplicatePolicy: values.duplicatePolicy,
      idempotencyKey: idempotencyKeyRef.current,
    })
  }

  function handleReset() {
    setFile(null)
    setSubmission(null)
    setNeedsName(false)
    setValidationReport(null)
    setPollTimedOut(false)
    idempotencyKeyRef.current = ""
  }

  const showForm = current === null || current.status === "REJECTED" || current.status === "DUPLICATE"

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {current && <ImportStatusPanel status={current.status} />}

        {validationReport && <FileValidationSummary report={validationReport} />}

        {showForm && (
          // react-hook-form's `handleSubmit` returns an event handler without invoking the
          // callback during render; the ref read/write inside `onSubmit` only runs on the
          // actual submit event, not here.
          // eslint-disable-next-line react-hooks/refs
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={!!fileError}>
                <FieldLabel htmlFor="file">Arquivo</FieldLabel>
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
                <FieldError errors={fileError ? [{ message: fileError }] : undefined} />
              </Field>

              <Field data-invalid={!!errors.source}>
                <FieldLabel htmlFor="source">Fonte</FieldLabel>
                <Input id="source" placeholder="Ex.: ICMBio, FATMA, levantamento de campo" {...register("source")} />
                <FieldDescription>
                  Órgão ou levantamento responsável pelos dados geoespaciais deste arquivo, não o
                  tipo de cenário.
                </FieldDescription>
                <FieldError errors={errors.source ? [errors.source] : undefined} />
              </Field>

              {needsName && (
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="name">Nome</FieldLabel>
                  <Input id="name" {...register("name")} />
                  <FieldDescription>
                    O arquivo enviado não trouxe o nome da unidade de conservação.
                  </FieldDescription>
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="duplicate-policy">Ao encontrar UC já cadastrada</FieldLabel>
                <Controller
                  name="duplicatePolicy"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="duplicate-policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reject_batch">Rejeitar o lote inteiro</SelectItem>
                        <SelectItem value="skip_duplicates">Publicar só as inéditas</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
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
          <p className="text-sm text-success">Unidade de conservação publicada com sucesso.</p>
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
