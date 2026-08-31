// Categorias pré-definidas do módulo financeiro — vivem como constante
// (igual FRENTES/CONTEXTS em frentes.js). Categorias criadas pelo usuário
// ficam salvas em Firestore/localStorage (ver store.js, createFinanceCategory)
// e se juntam a essas na hora de exibir.
export const DEFAULT_EXPENSE_CATEGORIES = ["Alimentação", "Transporte", "Casa", "Lazer", "Trabalho", "Saúde", "Outros"];

export const DEFAULT_INCOME_CATEGORIES = ["Cachê", "Preset", "Curso", "Salário", "Outros"];

export const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Boleto", "Transferência"];

// Paleta categórica (Okabe-Ito — referência de segurança pra daltonismo em
// visualização de dados).
const CATEGORY_PALETTE = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0A800",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
  "#7A7A7A",
];

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Cor de uma categoria: posição fixa numa ordem canônica (padrões primeiro,
// na ordem da lista acima, depois as criadas pelo usuário por ordem de
// criação) — NÃO por hash do nome. Duas categorias de um mesmo tipo nunca
// caem no mesmo índice (até o tamanho da paleta), então nunca têm a mesma
// cor num gráfico onde as duas aparecem juntas. Gasto e entrada usam
// espaços de índice independentes (nunca aparecem na mesma pizza), então
// podem repetir cor entre si sem problema.
export function colorForCategory(name, tipo, customCategories = []) {
  const defaults = tipo === "entrada" ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const customNames = customCategories
    .filter((c) => c.tipo === tipo)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    .map((c) => c.nome);
  const order = [...defaults, ...customNames];
  let idx = order.indexOf(name);
  if (idx === -1) idx = hashStr(String(name || "")); // categoria fora da lista conhecida — fallback estável, sem garantia de índice único
  return CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length];
}
