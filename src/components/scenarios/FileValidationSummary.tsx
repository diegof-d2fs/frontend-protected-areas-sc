import { CheckCircle2, FileType, Globe2, Shapes, TriangleAlert, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ValidationReport } from "@/lib/api/imports"

function StatTile({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof FileType
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-medium break-words text-foreground", mono && "font-mono text-xs")}>
          {value}
        </p>
      </div>
    </div>
  )
}

/**
 * Pré-visualização do arquivo antes de iniciar o processamento — o mesmo relatório que a API já
 * devolve na validação, só organizado para ser lido de relance em vez de como uma lista técnica.
 */
export function FileValidationSummary({ report }: { report: ValidationReport }) {
  if (!report.detected_format) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        {report.valid ? (
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        ) : (
          <XCircle className="size-4 text-destructive" aria-hidden="true" />
        )}
        <p className="text-sm font-medium text-foreground">
          {report.valid ? "Arquivo válido" : "Arquivo com pendências"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={FileType} label="Formato" value={report.detected_format} mono />
        <StatTile icon={Shapes} label="Unidades" value={String(report.feature_count)} />
        <StatTile
          icon={Shapes}
          label="Geometria"
          value={report.geometry_types.join(", ") || "não detectada"}
        />
        <StatTile
          icon={Globe2}
          label="Coordenadas"
          value={
            report.source_crs && report.source_crs === report.target_crs
              ? report.target_crs
              : `${report.source_crs ?? "não informado"} → ${report.target_crs}`
          }
          mono
        />
      </div>

      {report.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-sm text-warning-foreground">
          {report.warnings.map((warning) => (
            <div key={warning.code} className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {report.errors.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
          {report.errors.map((issue) => (
            <div key={issue.code} className="flex items-start gap-2">
              <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
