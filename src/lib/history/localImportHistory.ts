import type { SubmissionView } from "@/lib/api/imports"

export interface HistoryEntry {
  scenarioCode: string
  scenarioTitle: string
  submission: SubmissionView
}

const STORAGE_KEY = "import-history"

function readStoredEntries(): Map<string, HistoryEntry> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as HistoryEntry[]
    return new Map(parsed.map((entry) => [entry.submission.import_id, entry]))
  } catch {
    return new Map()
  }
}

function writeStoredEntries(entries: Map<string, HistoryEntry>) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...entries.values()]))
  } catch {
    // Armazenamento indisponível (modo privado, política do navegador): o histórico só não
    // sobrevive a uma atualização de página nesse caso, sem quebrar o registro em si.
  }
}

/**
 * Histórico das importações executadas nesta navegação. Guarda em `sessionStorage` (sobrevive a
 * uma atualização de página, nunca a mais que isso, o mesmo comportamento da sessão mock) a
 * versão mais recente de cada importação, não um log de cada mudança de estado.
 */
class LocalImportHistory {
  private entries = readStoredEntries()

  record(scenarioCode: string, scenarioTitle: string, submission: SubmissionView) {
    this.entries.set(submission.import_id, { scenarioCode, scenarioTitle, submission })
    writeStoredEntries(this.entries)
  }

  get(importId: string): HistoryEntry | undefined {
    return this.entries.get(importId)
  }

  list(): HistoryEntry[] {
    return [...this.entries.values()].sort(
      (a, b) => new Date(b.submission.updated_at).getTime() - new Date(a.submission.updated_at).getTime(),
    )
  }
}

export const localImportHistory = new LocalImportHistory()
