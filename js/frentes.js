export const FRENTES = [
  { key: "devocional", label: "Devocional", icon: "devocional", color: "var(--c-devocional)", kind: "habit" },
  { key: "casa", label: "Casa", icon: "casa", color: "var(--c-casa)", kind: "list" },
  { key: "saude", label: "Saúde", icon: "saude", color: "var(--c-saude)", kind: "habit" },
  { key: "estudo", label: "Estudo", icon: "estudo", color: "var(--c-estudo)", kind: "list" },
  { key: "trabalho", label: "Trabalho", icon: "trabalho", color: "var(--c-trabalho)", kind: "board" },
  { key: "financeiro", label: "Financeiro", icon: "financeiro", color: "var(--c-financeiro)", kind: "list" },
];

export function frenteByKey(key) {
  return FRENTES.find((f) => f.key === key);
}

export const CONTEXTS = [
  { key: "IC", label: "Igreja da Cidade" },
  { key: "DB", label: "Belizario Produções" },
  { key: "PP", label: "Projetos Pessoais" },
];

export function contextLabel(key) {
  return CONTEXTS.find((c) => c.key === key)?.label || key;
}

// As 3 colunas reais do quadro de Trabalho. Itens com qualquer outro valor
// de coluna (ex: "inbox"/"blocked" de versões antigas) não desaparecem —
// caem na lista "Todas as tarefas" em trabalho.js até serem organizados.
export const COLUMNS = [
  { key: "todo", label: "A Fazer" },
  { key: "doing", label: "Fazendo" },
  { key: "done", label: "Concluído" },
];
