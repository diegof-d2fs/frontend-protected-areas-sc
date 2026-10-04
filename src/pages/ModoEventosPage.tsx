import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Hourglass,
  Loader2,
  Power,
  RotateCcw,
  Server,
  Timer,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import {
  activateEventMode,
  cancelEventMode,
  deactivateEventMode,
  extendEventMode,
  getEventCredentials,
  getEventHistory,
  getEventMode,
  type EventCredentials,
  type EventModeRules,
  type EventStatus,
  type EventView,
} from "@/lib/api/eventMode"
import { cn } from "@/lib/utils"

const TIME_ZONE = "America/Sao_Paulo"
// Brasília não tem horário de verão desde 2019: o campo de data e hora é lido com deslocamento fixo.
const BRASILIA_OFFSET = "-03:00"

const STATUS: Record<EventStatus, { label: string; className: string }> = {
  agendado: { label: "Agendado", className: "bg-secondary text-secondary-foreground" },
  ativando: { label: "Ativando", className: "bg-warning text-warning-foreground" },
  ativo: { label: "Ativo", className: "bg-success text-success-foreground" },
  desativando: { label: "Voltando ao normal", className: "bg-warning text-warning-foreground" },
  encerrado: { label: "Encerrado", className: "bg-secondary text-muted-foreground" },
  cancelado: { label: "Cancelado", className: "bg-secondary text-muted-foreground" },
  falhou: { label: "Falhou", className: "bg-destructive/15 text-destructive" },
}

// Passos dos runbooks na AWS, na ordem em que acontecem, com o texto mostrado ao administrador.
const ACTIVATION_STEPS = [
  { id: "pararServidor", label: "Parando o servidor" },
  { id: "trocarTamanho", label: "Ampliando para 8 GB de memória" },
  { id: "ligarServidor", label: "Religando o servidor" },
  { id: "aguardarAgente", label: "Aguardando a máquina responder" },
  { id: "verificarSaude", label: "Conferindo o site e os mapas" },
  { id: "criarAcesso", label: "Criando o acesso ao banco do evento" },
  { id: "pregerarMapas", label: "Iniciando a pré-geração de mapas" },
]
const RETURN_STEPS = [
  { id: "revogarAcesso", label: "Removendo o acesso do evento" },
  { id: "lerTamanho", label: "Conferindo o tamanho atual" },
  { id: "pararServidor", label: "Parando o servidor" },
  { id: "trocarTamanho", label: "Voltando ao tamanho normal" },
  { id: "ligarServidor", label: "Religando o servidor" },
  { id: "aguardarAgente", label: "Aguardando a máquina responder" },
  { id: "verificarSaude", label: "Conferindo o site e os mapas" },
]

function formatDateTime(value: string | null): string {
  if (!value) return ""
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatUsd(value: number): string {
  return `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`
  return `${minutes} min ${String(rest).padStart(2, "0")} s`
}

/** Valor para `<input type="datetime-local">`, no horário de Brasília. */
function toLocalInput(date: Date): string {
  const shifted = new Date(date.getTime() - 3 * 3600 * 1000)
  return shifted.toISOString().slice(0, 16)
}

function fromLocalInput(value: string): string {
  return `${value}:00${BRASILIA_OFFSET}`
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.problem.detail
  return "Não foi possível falar com o servidor. Tente de novo em instantes."
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  )
}

function Explanation({ rules }: { rules: EventModeRules }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Para que serve</CardTitle>
        <CardDescription>
          Em oficinas e apresentações, dezenas de pessoas abrem o mapa e o QGIS ao mesmo tempo. O servidor
          normal, com 2 GB de memória, não aguenta esse pico. O modo eventos amplia o servidor por algumas
          horas e volta sozinho ao tamanho normal no horário que você definir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">O que muda</span>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
              <li>Servidor passa de 2 GB para 8 GB de memória.</li>
              <li>O GeoServer recebe mais memória para responder aos mapas.</li>
              <li>Um login de banco somente leitura é criado só para o evento.</li>
              <li>Os mapas de Santa Catarina são pré-gerados para abrir mais rápido.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">O que não muda</span>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
              <li>Os dados, os endereços do site e dos serviços de mapa.</li>
              <li>O processamento das cargas, que roda em outra máquina.</li>
              <li>Os logins do painel e o acesso do Power BI.</li>
            </ul>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            icon={Zap}
            label="Pronto para uso em"
            value={`cerca de ${rules.estimated_activation_minutes} minutos`}
          />
          <Fact
            icon={AlertTriangle}
            label="Fora do ar ao ativar e ao voltar"
            value={`${rules.estimated_downtime_minutes} minutos em cada troca`}
          />
          <Fact
            icon={Hourglass}
            label="Desempenho pleno, com mapas prontos"
            value={`${rules.estimated_full_performance_minutes} minutos`}
          />
          <Fact
            icon={Timer}
            label="Tempo mínimo antes de desativar"
            value={`${rules.min_active_minutes} minutos depois de ativo`}
          />
          <Fact
            icon={RotateCcw}
            label="Retorno automático"
            value={`padrão de ${rules.default_duration_hours} h, no máximo ${rules.max_duration_hours} h`}
          />
          <Fact
            icon={CircleDollarSign}
            label="Custo extra"
            value={`${formatUsd(rules.extra_cost_usd_per_hour)} por hora ativa`}
          />
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          Ative pelo menos {rules.recommended_lead_minutes} minutos antes do início, ou agende, para que a troca
          não aconteça com as pessoas já conectadas.
        </p>
      </CardContent>
    </Card>
  )
}

function ActivationForm({ rules, onActivated }: { rules: EventModeRules; onActivated: () => void }) {
  const [nome, setNome] = useState("")
  const [agendar, setAgendar] = useState(false)
  const [inicio, setInicio] = useState(() => toLocalInput(new Date(Date.now() + 2 * 3600 * 1000)))
  const [horas, setHoras] = useState(String(rules.default_duration_hours))
  const [confirming, setConfirming] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const now = useNow(15000)

  const start = agendar ? new Date(fromLocalInput(inicio)) : new Date(now)
  const duration = Number(horas)
  const validDuration =
    Number.isFinite(duration) && duration * 60 >= rules.min_active_minutes && duration <= rules.max_duration_hours
  const end = new Date(start.getTime() + (validDuration ? duration : 0) * 3600 * 1000)
  const canSubmit = nome.trim().length >= 2 && validDuration && (!agendar || start.getTime() > now)

  const mutation = useMutation({
    mutationFn: () =>
      activateEventMode({
        nome,
        inicio: agendar ? fromLocalInput(inicio) : null,
        retornoAutomaticoEm: end.toISOString(),
        idempotencyKey,
      }),
    onSuccess: () => {
      setConfirming(false)
      toast.success(agendar ? "Modo eventos agendado." : "Ativação iniciada. O site sai do ar em instantes.")
      onActivated()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ativar modo eventos</CardTitle>
        <CardDescription>Nenhum evento em andamento.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="evento-nome">Instituição ou nome do evento</Label>
          <Input
            id="evento-nome"
            value={nome}
            maxLength={80}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Por exemplo: Univali Itajaí"
          />
          <p className="text-xs text-muted-foreground">Usado no nome do login de banco do evento e no histórico.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Quando ativar</span>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {[
              { value: false, title: "Agora", text: "A troca começa assim que você confirmar." },
              { value: true, title: "Agendar", text: "A troca começa sozinha no horário escolhido." },
            ].map((option) => (
              <button
                key={option.title}
                type="button"
                role="radio"
                aria-checked={agendar === option.value}
                onClick={() => setAgendar(option.value)}
                className={cn(
                  "flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  agendar === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                )}
              >
                <span className={cn("text-sm font-medium", agendar === option.value && "text-primary")}>
                  {option.title}
                </span>
                <span className="text-xs text-muted-foreground">{option.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {agendar && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evento-inicio">Início (horário de Brasília)</Label>
              <Input
                id="evento-inicio"
                type="datetime-local"
                value={inicio}
                onChange={(event) => setInicio(event.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="evento-horas">Duração até o retorno automático (horas)</Label>
            <Input
              id="evento-horas"
              type="number"
              min={Math.ceil(rules.min_active_minutes / 60)}
              max={rules.max_duration_hours}
              step={0.5}
              value={horas}
              onChange={(event) => setHoras(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border p-3 text-sm">
          <span>
            Volta ao tamanho normal em <strong>{validDuration ? formatDateTime(end.toISOString()) : "?"}</strong>
          </span>
          <span className="text-muted-foreground">
            Custo extra estimado: {validDuration ? formatUsd(duration * rules.extra_cost_usd_per_hour) : "?"}
          </span>
        </div>

        <div>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              setUnderstood(false)
              setConfirming(true)
            }}
          >
            <Zap aria-hidden="true" />
            {agendar ? "Agendar modo eventos" : "Ativar modo eventos"}
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirming} onOpenChange={(open) => !mutation.isPending && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{agendar ? "Confirmar agendamento" : "Confirmar ativação agora"}</DialogTitle>
            <DialogDescription>
              {agendar
                ? `A ampliação começa em ${formatDateTime(start.toISOString())}.`
                : "A ampliação começa assim que você confirmar."}
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2 text-sm">
            <li>Evento: <strong>{nome.trim()}</strong></li>
            <li>
              O site, a API e os mapas ficam fora do ar por {rules.estimated_downtime_minutes} minutos durante a
              troca, e de novo na volta.
            </li>
            <li>Volta ao normal sozinho em {formatDateTime(end.toISOString())}.</li>
            <li>
              Só é possível desativar antes disso depois de {rules.min_active_minutes} minutos com o modo ativo.
            </li>
          </ul>
          <label className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--primary)]"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
            />
            Entendo que o sistema ficará fora do ar por alguns minutos.
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setConfirming(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              disabled={!understood || mutation.isPending}
              onClick={() => {
                mutation.mutate(undefined, { onError: () => setIdempotencyKey(crypto.randomUUID()) })
              }}
            >
              {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Zap aria-hidden="true" />}
              {agendar ? "Agendar" : "Ativar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function Progress({ event, apiDown }: { event: EventView; apiDown: boolean }) {
  const steps = event.status === "ativando" ? ACTIVATION_STEPS : RETURN_STEPS
  const currentIndex = steps.findIndex((step) => step.id === event.current_step)

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">
            {event.status === "ativando" ? "Ativando o modo eventos" : "Voltando ao tamanho normal"}
          </CardTitle>
          <Badge className={STATUS[event.status].className}>{STATUS[event.status].label}</Badge>
        </div>
        <CardDescription>
          {event.nome}. A troca leva cerca de 5 minutos; a página se atualiza sozinha.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {apiDown && (
          <p className="flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm">
            <Server className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            O servidor está sendo trocado e a API não responde agora; isso é esperado. Esta página continua tentando
            sozinha.
          </p>
        )}
        <ol className="flex flex-col gap-0">
          {steps.map((step, index) => {
            const done = currentIndex > index
            const active = currentIndex === index || (currentIndex === -1 && index === 0)
            return (
              <li key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border text-xs",
                      done && "border-success bg-success text-success-foreground",
                      active && "border-primary text-primary",
                      !done && !active && "border-border text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : active ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {index < steps.length - 1 && <span className="h-4 w-px bg-border" aria-hidden="true" />}
                </div>
                <span
                  className={cn(
                    "pt-0.5 text-sm",
                    active ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>
        {event.execution_url && <ExecutionLink url={event.execution_url} />}
      </CardContent>
    </Card>
  )
}

function ExecutionLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
    >
      <ExternalLink className="size-3.5" aria-hidden="true" />
      Ver a execução no console da AWS
    </a>
  )
}

function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [visible, setVisible] = useState(!secret)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-[0.8rem]">
          {visible ? value : "••••••••••••"}
        </code>
        {secret && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Copiar ${label}`}
          onClick={() =>
            navigator.clipboard.writeText(value).then(
              () => toast.success(`${label} copiado.`),
              () => toast.error("Não foi possível copiar."),
            )
          }
        >
          <Copy aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

function Credentials({ event }: { event: EventView }) {
  const [credentials, setCredentials] = useState<EventCredentials | null>(null)
  const mutation = useMutation({
    mutationFn: () => getEventCredentials(event.id),
    onSuccess: setCredentials,
    onError: (error) => toast.error(errorMessage(error)),
  })

  if (!credentials) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">
          Login somente leitura para distribuir aos participantes (QGIS e Power BI). Cada consulta fica registrada.
        </p>
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          <Eye aria-hidden="true" />
          Mostrar dados de acesso
        </Button>
      </div>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CopyField label="Servidor do banco" value={`${credentials.db_host}:${credentials.db_port}`} />
      <CopyField label="Banco" value={credentials.db_name} />
      <CopyField label="Usuário" value={credentials.db_login} />
      <CopyField label="Senha" value={credentials.db_password} secret />
      <div className="sm:col-span-2">
        <CopyField label="Serviços de mapa (WMS, WFS e WCS)" value={credentials.ogc_base_url} />
      </div>
    </div>
  )
}

function ActiveEvent({ event, rules, onChanged }: { event: EventView; rules: EventModeRules; onChanged: () => void }) {
  const now = useNow()
  const [confirmingOff, setConfirmingOff] = useState(false)
  const [extendHours, setExtendHours] = useState("1")
  const allowedAt = event.deactivate_allowed_at ? new Date(event.deactivate_allowed_at).getTime() : 0
  const waitSeconds = (allowedAt - now) / 1000
  const locked = waitSeconds > 0
  const returnAt = new Date(event.auto_return_at)
  const ceiling = new Date(new Date(event.activated_at ?? event.starts_at).getTime() + rules.max_duration_hours * 3600 * 1000)

  const deactivate = useMutation({
    mutationFn: () => deactivateEventMode(event.id),
    onSuccess: () => {
      setConfirmingOff(false)
      toast.success("Retorno iniciado. O site sai do ar em instantes.")
      onChanged()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const extend = useMutation({
    mutationFn: () =>
      extendEventMode(event.id, new Date(returnAt.getTime() + Number(extendHours) * 3600 * 1000).toISOString()),
    onSuccess: () => {
      toast.success("Retorno automático adiado.")
      onChanged()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Modo eventos ativo</CardTitle>
          <Badge className={STATUS.ativo.className}>{STATUS.ativo.label}</Badge>
        </div>
        <CardDescription>
          {event.nome}, ativado por {event.requested_by_name} em {formatDateTime(event.activated_at)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Fact icon={RotateCcw} label="Retorno automático" value={formatDateTime(event.auto_return_at)} />
          <Fact
            icon={Timer}
            label="Desativação manual"
            value={locked ? `liberada em ${formatDuration(waitSeconds)}` : "liberada"}
          />
          <Fact icon={CircleDollarSign} label="Custo extra até agora" value={formatUsd(event.estimated_cost_usd)} />
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Acesso para os participantes</h3>
          <Credentials event={event} />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Adiar o retorno</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evento-estender">Horas a mais</Label>
              <Input
                id="evento-estender"
                type="number"
                min={0.5}
                step={0.5}
                className="w-28"
                value={extendHours}
                onChange={(e) => setExtendHours(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={extend.isPending || !(Number(extendHours) > 0)}
              onClick={() => extend.mutate()}
            >
              <Clock aria-hidden="true" />
              Adiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Limite deste evento: {formatDateTime(ceiling.toISOString())} ({rules.max_duration_hours} h depois da ativação).
          </p>
        </section>

        <section className="flex flex-col items-start gap-2 border-t border-border pt-4">
          <Button type="button" variant="destructive" disabled={locked} onClick={() => setConfirmingOff(true)}>
            <Power aria-hidden="true" />
            Desativar agora
          </Button>
          <p className="text-xs text-muted-foreground">
            {locked
              ? `Para proteger a oficina, a desativação manual só é liberada ${rules.min_active_minutes} minutos depois da ativação.`
              : "Volta o servidor ao tamanho normal; o site fica fora do ar por alguns minutos."}
          </p>
        </section>
      </CardContent>

      <Dialog open={confirmingOff} onOpenChange={(open) => !deactivate.isPending && setConfirmingOff(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar o modo eventos?</DialogTitle>
            <DialogDescription>
              O login do evento deixa de funcionar e quem estiver conectado é desconectado. O site fica fora do ar
              por {rules.estimated_downtime_minutes} minutos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deactivate.isPending} onClick={() => setConfirmingOff(false)}>
              Manter ativo
            </Button>
            <Button type="button" variant="destructive" disabled={deactivate.isPending} onClick={() => deactivate.mutate()}>
              {deactivate.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Power aria-hidden="true" />}
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ScheduledEvent({ event, onChanged }: { event: EventView; onChanged: () => void }) {
  const cancel = useMutation({
    mutationFn: () => cancelEventMode(event.id),
    onSuccess: () => {
      toast.success("Agendamento cancelado.")
      onChanged()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Modo eventos agendado</CardTitle>
          <Badge className={STATUS.agendado.className}>{STATUS.agendado.label}</Badge>
        </div>
        <CardDescription>{event.nome}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Fact icon={Zap} label="Ampliação começa" value={formatDateTime(event.starts_at)} />
          <Fact icon={RotateCcw} label="Retorno automático" value={formatDateTime(event.auto_return_at)} />
          <Fact icon={CircleDollarSign} label="Custo extra estimado" value={formatUsd(event.estimated_cost_usd)} />
        </div>
        <div>
          <Button type="button" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancelar agendamento
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FailedEvent({ event, onChanged }: { event: EventView; onChanged: () => void }) {
  const forceReturn = useMutation({
    mutationFn: () => deactivateEventMode(event.id),
    onSuccess: () => {
      toast.success("Retorno forçado iniciado.")
      onChanged()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <Card className="ring-destructive/40">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">A automação do modo eventos falhou</CardTitle>
          <Badge className={STATUS.falhou.className}>{STATUS.falhou.label}</Badge>
        </div>
        <CardDescription>{event.nome}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-foreground">{event.failure_message}</p>
        <p>
          A automação religa o servidor em qualquer falha, mas ele pode ter ficado no tamanho ampliado. Use o retorno
          forçado para garantir o tamanho normal e remover o acesso do evento. Um novo evento só pode ser ativado depois
          disso.
        </p>
        {event.execution_url && <ExecutionLink url={event.execution_url} />}
        <div>
          <Button type="button" variant="destructive" disabled={forceReturn.isPending} onClick={() => forceReturn.mutate()}>
            <RotateCcw aria-hidden="true" />
            Forçar retorno ao tamanho normal
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function History() {
  const { data } = useQuery({ queryKey: ["event-mode-history"], queryFn: getEventHistory })
  if (!data || data.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Histórico</h2>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Custo extra</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col">
                    <span className="font-medium">{event.nome}</span>
                    <span className="text-xs text-muted-foreground">por {event.requested_by_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS[event.status].className}>{STATUS[event.status].label}</Badge>
                </TableCell>
                <TableCell className="text-sm whitespace-normal">
                  {formatDateTime(event.activated_at ?? event.starts_at)}
                  {event.finished_at && ` até ${formatDateTime(event.finished_at)}`}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(event.estimated_cost_usd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

export function ModoEventosPage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["event-mode"],
    queryFn: getEventMode,
    retry: false,
    // Durante a troca a API fica fora do ar: a consulta continua, com intervalo maior a cada falha.
    refetchInterval: (q) => {
      const status = q.state.data?.current?.status
      const transitioning = status === "ativando" || status === "desativando"
      if (q.state.status === "error") return 15000
      return transitioning ? 5000 : 30000
    },
  })

  // Numa falha de consulta o React Query mantém o último estado válido; é ele que a tela mostra.
  const state = query.data ?? null
  const event = state?.current ?? null
  const apiDown = query.isError && !!state
  const refresh = useMemo(
    () => () => {
      queryClient.invalidateQueries({ queryKey: ["event-mode"] })
      queryClient.invalidateQueries({ queryKey: ["event-mode-history"] })
    },
    [queryClient],
  )

  useEffect(() => {
    if (event?.status === "encerrado" || event?.status === "ativo") {
      queryClient.invalidateQueries({ queryKey: ["event-mode-history"] })
    }
  }, [event?.status, queryClient])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Modo eventos</h1>
        <p className="text-sm text-muted-foreground">
          Amplia o servidor durante oficinas e apresentações. Visível só para administradores.
        </p>
      </div>

      {!state && query.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!state && query.isError && (
        <p className="text-sm text-destructive">{errorMessage(query.error)}</p>
      )}

      {state && (
        <>
          {!state.configured && (
            <p className="rounded-lg bg-warning/15 px-3 py-2 text-sm">
              A automação não está configurada neste ambiente; a ativação fica indisponível.
            </p>
          )}
          {event && (event.status === "ativando" || event.status === "desativando") && (
            <Progress event={event} apiDown={apiDown} />
          )}
          {event?.status === "ativo" && <ActiveEvent event={event} rules={state.rules} onChanged={refresh} />}
          {event?.status === "agendado" && <ScheduledEvent event={event} onChanged={refresh} />}
          {event?.status === "falhou" && <FailedEvent event={event} onChanged={refresh} />}
          {event?.status === "encerrado" && (
            <p className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm">
              <Check className="size-4" aria-hidden="true" />
              O servidor voltou ao tamanho normal e o acesso do evento foi removido.
            </p>
          )}
          {(!event || event.status === "encerrado" || event.status === "cancelado") && state.configured && (
            <ActivationForm rules={state.rules} onActivated={refresh} />
          )}
          <Explanation rules={state.rules} />
          <History />
        </>
      )}
    </div>
  )
}
