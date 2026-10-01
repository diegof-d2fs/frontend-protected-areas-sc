import { CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SubmissionStatus } from "@/lib/api/imports"

const STEPS = [
  { label: "Enviado" },
  { label: "Validado" },
  { label: "Publicado" },
  { label: "Processando" },
  { label: "Concluído" },
] as const

function stepIndexForStatus(status: SubmissionStatus): number {
  switch (status) {
    case "RECEIVED":
    case "VALIDATING":
      return 0
    case "ACCEPTED":
    case "REJECTED":
    case "DUPLICATE":
      return 1
    case "PUBLISHED":
      return 2
    case "PROCESSING":
      return 3
    case "FAILED":
      return 3
    case "SUCCEEDED":
      return 4
  }
}

const FAILURE_STATUSES: readonly SubmissionStatus[] = ["REJECTED", "DUPLICATE", "FAILED"]

/** Indicador de etapas do acompanhamento de uma importação, do envio até o estado terminal. */
export function ImportStatusPanel({ status }: { status: SubmissionStatus }) {
  const currentIndex = stepIndexForStatus(status)
  const failed = FAILURE_STATUSES.includes(status)

  return (
    <div className="space-y-2">
      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((step, index) => {
          const isCurrent = index === currentIndex
          const isPast = index < currentIndex
          const isFailedStep = isCurrent && failed
          const isDoneStep = isCurrent && status === "SUCCEEDED"

          return (
            <li key={step.label} className="flex items-center gap-2">
              {index > 0 && <span className="h-px w-4 bg-border" aria-hidden="true" />}
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  isPast && "border-success/40 bg-success/10 text-success",
                  isFailedStep && "border-destructive/40 bg-destructive/10 text-destructive",
                  isDoneStep && "border-success/40 bg-success/10 text-success",
                  isCurrent && !isFailedStep && !isDoneStep && "border-primary/40 bg-primary/10 text-primary",
                  !isPast && !isCurrent && "border-border text-muted-foreground",
                )}
              >
                {isFailedStep ? (
                  <XCircle className="size-3.5" aria-hidden="true" />
                ) : isPast || isDoneStep ? (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                ) : (
                  <CircleDashed className="size-3.5" aria-hidden="true" />
                )}
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
      {status === "PUBLISHED" && (
        <p className="text-xs text-muted-foreground">
          Na fila de processamento. O processamento é iniciado sob demanda e pode levar alguns minutos
          para começar; o acompanhamento continua automaticamente.
        </p>
      )}
    </div>
  )
}
