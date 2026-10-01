// Tradução dos códigos de erro de negócio já documentados no contrato da API para pt-BR. Um
// código fora deste mapa cai num texto genérico; o `detail`/`type` originais continuam
// disponíveis para quem pedir detalhe técnico, nunca escondidos, só não são a mensagem principal.
const ERROR_MESSAGES: Record<string, string> = {
  UC_ALREADY_EXISTS: "Essa UC já está cadastrada.",
  UC_VERSION_CONFLICT:
    "Alguém alterou essa UC desde a última consulta. Recarregue a versão atual e tente de novo.",
  MISSING_UC_NAME: "O arquivo não traz o nome da UC. Preencha o campo Nome e envie novamente.",
  ZA_CREATE_REQUIRES_BATCH:
    'Não é possível cadastrar uma ZA isolada. Use "Substituir Buffer de Abrangência por ZA oficial" numa UC existente.',
  DUPLICATE: "Essa importação já foi enviada antes. Mostrando o resultado original.",
}

export function translateErrorCode(code: string | null | undefined, fallback: string): string {
  if (!code) {
    return fallback
  }
  return ERROR_MESSAGES[code] ?? fallback
}
