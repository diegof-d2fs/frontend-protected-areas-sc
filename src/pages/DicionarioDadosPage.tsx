import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileArchive,
  FileCode2,
  Globe2,
  Map as MapIcon,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getDataDictionary,
  type ColumnRequirement,
  type ColumnType,
  type DataDictionary,
  type DictionaryBase,
  type DictionaryColumn,
  type DictionaryError,
} from "@/lib/api/dataDictionary"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<ColumnType, string> = {
  texto: "Texto",
  data: "Data",
  numero_decimal: "Número decimal",
  inteiro: "Inteiro",
  booleano: "Sim/não",
}

const REQUIREMENT: Record<ColumnRequirement, { label: string; className: string }> = {
  obrigatorio: { label: "Obrigatório", className: "bg-primary text-primary-foreground" },
  identificador_forte: {
    label: "Identificador forte",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  opcional: { label: "Opcional", className: "bg-secondary text-muted-foreground" },
}

const STAGE_LABEL: Record<string, string> = {
  arquivo: "Arquivo",
  "conteúdo": "Conteúdo",
  geometria: "Geometria",
  metadados: "Metadados",
  lote: "Lote",
}

const FORMAT_ICON: Record<string, typeof FileArchive> = {
  shapefile_zip: FileArchive,
  geojson: FileCode2,
  kml: Globe2,
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado.`),
    () => toast.error("Não foi possível copiar."),
  )
}

function downloadExample(base: DictionaryBase) {
  if (!base.example_geojson) return
  const blob = new Blob([JSON.stringify(base.example_geojson, null, 2)], {
    type: "application/geo+json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `modelo-${base.id}.geojson`
  link.click()
  URL.revokeObjectURL(url)
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

function Code({ children, className }: { children: string; className?: string }) {
  return (
    <code className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground", className)}>
      {children}
    </code>
  )
}

// Os textos da API marcam identificadores técnicos entre crases, como em Markdown; aqui eles viram
// o mesmo estilo monoespaçado das colunas, sem interpretar nenhum outro Markdown.
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, index) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
          <Code key={index}>{part.slice(1, -1)}</Code>
        ) : (
          part
        ),
      )}
    </>
  )
}

function CopyName({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Code className="font-medium">{name}</Code>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Copiar ${name}`}
        onClick={() => copy(name, `Nome "${name}"`)}
      >
        <Copy aria-hidden="true" />
      </Button>
    </span>
  )
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

function ColumnsTable({ columns }: { columns: DictionaryColumn[] }) {
  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma coluna corresponde à busca.</p>
  }
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">Coluna</TableHead>
            <TableHead className="min-w-64">Descrição</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.map((column) => (
            <TableRow key={column.name} className="align-top">
              <TableCell className="py-3 whitespace-nowrap">
                <div className="flex flex-col items-start gap-1.5">
                  <CopyName name={column.name} />
                  <span className="text-xs text-muted-foreground">{TYPE_LABEL[column.type]}</span>
                  <Badge variant="outline" className={REQUIREMENT[column.requirement].className}>
                    {REQUIREMENT[column.requirement].label}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="py-3 whitespace-normal">
                <div className="flex flex-col gap-1.5 text-sm">
                  <p className="text-foreground">
                    <RichText text={column.description} />
                  </p>
                  <p className="text-muted-foreground">
                    Exemplo: <Code>{column.example}</Code>
                  </p>
                  {column.aliases.length > 0 && (
                    <p className="flex flex-wrap items-center gap-1 text-muted-foreground">
                      Também aceita:
                      {column.aliases.map((alias) => (
                        <Code key={alias} className="text-muted-foreground">
                          {alias}
                        </Code>
                      ))}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Gravado em <span className="font-mono">{column.destination}</span>
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function BaseDetail({ base, query }: { base: DictionaryBase; query: string }) {
  const [copied, setCopied] = useState(false)
  const columns = useMemo(() => {
    if (!query) return base.columns
    return base.columns.filter((column) =>
      normalize([column.name, ...column.aliases, column.description].join(" ")).includes(query),
    )
  }, [base.columns, query])
  const metadataJson = JSON.stringify(base.metadata_example, null, 2)

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{base.title}</CardTitle>
          <CardDescription>
            <RichText text={base.summary} />
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="font-mono">
            {base.endpoint}
          </Badge>
          {base.domain && (
            <Badge variant="secondary" className="font-mono">
              {base.operation ? `${base.domain}/${base.operation}` : base.domain}
            </Badge>
          )}
          {base.geometry_types.map((kind) => (
            <Badge key={kind} variant="secondary">
              {kind}
            </Badge>
          ))}
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
          <MapIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {base.feature_rule}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {base.columns.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle
              title="Colunas do arquivo"
              description="Os nomes são comparados sem diferenciar maiúsculas. Colunas fora desta lista são preservadas na Bronze, mas não alimentam o cadastro."
            />
            <ColumnsTable columns={columns} />
          </section>
        )}

        <section className="flex flex-col gap-3">
          <SectionTitle
            title="Metadados do envio"
            description="Campo metadata do formulário, em JSON. Os obrigatórios valem para esta operação."
          />
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Campo</TableHead>
                  <TableHead className="min-w-56">Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {base.metadata_fields.map((field) => (
                  <TableRow key={field.name} className="align-top">
                    <TableCell className="py-3 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1.5">
                        <Code className="font-medium">{field.name}</Code>
                        <span className="text-xs text-muted-foreground">
                          {field.type}
                          {field.max_length != null && `, até ${field.max_length} caracteres`}
                          {field.minimum != null && `, mínimo ${field.minimum}`}
                        </span>
                        <Badge
                          variant="outline"
                          className={REQUIREMENT[field.required ? "obrigatorio" : "opcional"].className}
                        >
                          {field.required ? "Obrigatório" : "Opcional"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 whitespace-normal text-sm text-foreground">
                      <RichText text={field.description} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 pr-12 font-mono text-[0.8rem] text-foreground">
              {metadataJson}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="absolute top-2 right-2"
              aria-label="Copiar exemplo de metadados"
              onClick={() => {
                copy(metadataJson, "Exemplo de metadados")
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle title="Regras desta base" />
          <ul className="flex flex-col gap-2">
            {base.rules.map((rule) => (
              <li key={rule} className="flex gap-2 text-sm text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>
                  <RichText text={rule} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        {base.example_geojson && (
          <section className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <SectionTitle
              title="Modelo para preencher"
              description="GeoJSON mínimo que passa na validação. Substitua geometria e atributos pelos seus."
            />
            <Button type="button" variant="outline" onClick={() => downloadExample(base)}>
              <Download aria-hidden="true" />
              Baixar modelo
            </Button>
          </section>
        )}
      </CardContent>
    </Card>
  )
}

function BasesTab({ dictionary, query }: { dictionary: DataDictionary; query: string }) {
  const [selectedId, setSelectedId] = useState(dictionary.bases[0]?.id)
  const selected = dictionary.bases.find((base) => base.id === selectedId) ?? dictionary.bases[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="Bases de envio">
        {dictionary.bases.map((base) => {
          const active = base.id === selected?.id
          return (
            <button
              key={base.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedId(base.id)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40 hover:bg-accent",
              )}
            >
              <span className={cn("text-sm font-medium", active ? "text-primary" : "text-foreground")}>
                {base.title}
              </span>
              <span className="line-clamp-3 text-xs text-muted-foreground">{base.summary}</span>
            </button>
          )
        })}
      </div>
      {selected && <BaseDetail key={selected.id} base={selected} query={query} />}
    </div>
  )
}

function FormatsTab({ dictionary }: { dictionary: DataDictionary }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-3">
        {dictionary.formats.map((format) => {
          const Icon = FORMAT_ICON[format.id] ?? FileCode2
          return (
            <Card key={format.id} size="sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-sm">{format.label}</CardTitle>
                </div>
                <div className="flex flex-wrap gap-1">
                  {format.extensions.map((extension) => (
                    <Badge key={extension} variant="secondary" className="font-mono">
                      {extension}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {format.required_files.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Obrigatórios no ZIP</span>
                    <div className="flex flex-wrap gap-1">
                      {format.required_files.map((file) => (
                        <Code key={file}>{file}</Code>
                      ))}
                    </div>
                  </div>
                )}
                {format.optional_files.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Opcionais</span>
                    <div className="flex flex-wrap gap-1">
                      {format.optional_files.map((file) => (
                        <Code key={file} className="text-muted-foreground">
                          {file}
                        </Code>
                      ))}
                    </div>
                  </div>
                )}
                <p>
                  <span className="font-medium">CRS: </span>
                  <RichText text={format.crs_rule} />
                </p>
                <p>
                  <span className="font-medium">Codificação: </span>
                  {format.encoding}
                </p>
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  {format.rules.map((rule) => (
                    <li key={rule}>
                      • <RichText text={rule} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle title="Limites por envio" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {dictionary.limits.map((limit) => (
            <div key={limit.key} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
              <span className="text-xs text-muted-foreground">{limit.label}</span>
              <span className="text-xl font-semibold text-foreground tabular-nums">
                {limit.unit === ":1" ? `${formatNumber(limit.value)}:1` : formatNumber(limit.value)}
                {limit.unit !== ":1" && (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{limit.unit}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Sistema de referência</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              Gravado em <Code>{dictionary.crs.canonical}</Code> (SIRGAS 2000); áreas e distâncias em{" "}
              <Code>{dictionary.crs.metric}</Code>.
            </p>
            <p className="text-muted-foreground">{dictionary.crs.accepted}</p>
            <p className="text-muted-foreground">{dictionary.crs.dimension}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Território e correção de geometria</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>{dictionary.territory.description}</p>
            <p className="font-mono text-xs text-muted-foreground">
              envelope [{dictionary.territory.bbox.map((value) => formatNumber(value)).join("; ")}]
            </p>
            <p className="text-muted-foreground">
              <RichText text={dictionary.geometry_repair} />
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

// Lista em vez de tabela: os códigos chegam a 45 caracteres e, numa tabela de quatro colunas,
// empurravam "Como corrigir" para fora da área visível. Agrupar por etapa também elimina a coluna
// de etapa e deixa o significado e a correção lado a lado, empilhados no celular.
function ErrorsTab({ errors }: { errors: DictionaryError[] }) {
  if (errors.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum erro corresponde à busca.</p>
  }
  const stages = [...new Set(errors.map((error) => error.stage))]
  return (
    <div className="flex flex-col gap-6">
      {stages.map((stage) => {
        const items = errors.filter((error) => error.stage === stage)
        return (
          <section key={stage} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{STAGE_LABEL[stage] ?? stage}</h3>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
              {items.map((error) => (
                <li key={error.code} className="flex flex-col gap-2 px-4 py-3">
                  <span className="flex items-start gap-1">
                    <Code className="font-medium break-all">{error.code}</Code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Copiar ${error.code}`}
                      onClick={() => copy(error.code, `Código ${error.code}`)}
                    >
                      <Copy aria-hidden="true" />
                    </Button>
                  </span>
                  <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-muted-foreground">O que significa</span>
                      <p className="text-foreground">
                        <RichText text={error.meaning} />
                      </p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-muted-foreground">Como corrigir</span>
                      <p className="flex gap-1.5 text-foreground">
                        <Wrench className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span>
                          <RichText text={error.fix} />
                        </span>
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function MaintainedTab({ dictionary }: { dictionary: DataDictionary }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Estas bases são obtidas e cruzadas automaticamente pelo pipeline para toda UC e zona cadastrada,
        com o histórico completo. Não é preciso enviá-las.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {dictionary.maintained_bases.map((base) => (
          <Card key={base.id} size="sm">
            <CardHeader>
              <CardTitle className="text-sm">{base.title}</CardTitle>
              <CardDescription>{base.source}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>{base.description}</p>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Atualização {base.refresh}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function DicionarioDadosPage() {
  const [search, setSearch] = useState("")
  const query = normalize(search.trim())
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["data-dictionary"],
    queryFn: getDataDictionary,
    staleTime: 60 * 60 * 1000,
  })

  const errors = useMemo(() => {
    if (!data) return []
    if (!query) return data.errors
    return data.errors.filter((error) =>
      normalize([error.code, error.meaning, error.fix].join(" ")).includes(query),
    )
  }, [data, query])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Dicionário de dados</h1>
        <p className="text-sm text-muted-foreground">
          O que cada arquivo precisa ter para ser aceito: formatos, colunas, metadados, limites e os erros
          mais comuns. As regras vêm da própria validação da API.
        </p>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar coluna, nome alternativo ou código de erro"
          aria-label="Buscar no dicionário"
          className="pl-8"
        />
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 text-sm">
            <p className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
              Não foi possível carregar o dicionário.
            </p>
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <Tabs defaultValue="bases" className="gap-4">
          <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="bases">Bases de envio</TabsTrigger>
            <TabsTrigger value="formatos">Formatos e limites</TabsTrigger>
            <TabsTrigger value="erros">
              Erros comuns
              {query && <Badge variant="secondary">{errors.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="automaticas">Bases automáticas</TabsTrigger>
          </TabsList>
          <TabsContent value="bases">
            <BasesTab dictionary={data} query={query} />
          </TabsContent>
          <TabsContent value="formatos">
            <FormatsTab dictionary={data} />
          </TabsContent>
          <TabsContent value="erros">
            <ErrorsTab errors={errors} />
          </TabsContent>
          <TabsContent value="automaticas">
            <MaintainedTab dictionary={data} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
