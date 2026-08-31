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

// Aplica/troca o prefixo "Frente: " no valor de uma caixa de comando
// rápido — usado pelo seletor de frente ao lado da caixa de texto. Se o
// texto já começa com um prefixo de frente reconhecido, troca só ele; senão
// só adiciona na frente, sem mexer no resto do que já foi digitado.
export function withFrentePrefix(currentValue, frenteKey) {
  const frente = frenteByKey(frenteKey);
  if (!frente) return currentValue;
  const raw = String(currentValue || "");
  const colonIdx = raw.indexOf(":");
  let rest = raw;
  if (colonIdx !== -1) {
    const maybeLabel = raw.slice(0, colonIdx).trim().toLowerCase();
    const isFrente = FRENTES.some((f) => f.label.toLowerCase() === maybeLabel || f.key.toLowerCase() === maybeLabel);
    if (isFrente) rest = raw.slice(colonIdx + 1).trim();
  }
  return rest ? `${frente.label}: ${rest}` : `${frente.label}: `;
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
