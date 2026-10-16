// Funções de apoio e onde os dados ficam guardados (no navegador de cada pessoa).

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataCurta = (s) => { const d = parseYmd(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const fimDoMes = (ano, mes) => ymd(new Date(ano, mes + 1, 0)); // mes: 0-11
// "1.234,56" / "1234.56" / "1234,5" -> número
const lerValor = (s) => {
  let t = String(s).trim().replace(/[R$\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

const CATEGORIAS = {
  entrada: ['Salário', 'Vendas', 'Serviços / freelas', 'Pix recebido', 'Investimentos', 'Outras entradas'],
  saida: ['Moradia', 'Mercado', 'Alimentação fora', 'Transporte', 'Contas (água, luz, internet)', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Assinaturas', 'Cartão de crédito', 'Outras saídas'],
};
const FORMAS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Boleto', 'Transferência'];

const Dados = (() => {
  const KEY = 'finanflow_lancamentos';
  let falhou = false;
  const ler = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const gravar = (l) => {
    try { localStorage.setItem(KEY, JSON.stringify(l)); localStorage.setItem(KEY + '_alterado', new Date().toISOString()); }
    catch { falhou = true; }
  };
  const norm = (l) => ({ ...l, valor: Number(l.valor) });
  const ordenar = (a, b) => b.data.localeCompare(a.data) || b.id - a.id;
  const novoId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

  return {
    get semArmazenamento() { return falhou; },
    total: () => ler().length,

    // Lançamentos entre duas datas (inclusive)
    listar: (de, ate) => ler().filter((l) => l.data >= de && l.data <= ate).map(norm).sort(ordenar),

    // Pendentes já vencidos, de qualquer mês
    atrasados: (hoje) => ler().filter((l) => !l.pago && l.data < hoje).map(norm).sort((a, b) => a.data.localeCompare(b.data)),

    salvar(l) {
      const campos = {
        tipo: l.tipo, descricao: l.descricao, valor: l.valor, categoria: l.categoria,
        forma: l.forma || '', data: l.data, pago: !!l.pago, observacao: l.observacao || '',
      };
      const lista = ler();
      if (l.id) gravar(lista.map((x) => (x.id === l.id ? { ...x, ...campos } : x)));
      else { lista.push({ ...campos, id: novoId(), criado_em: new Date().toISOString() }); gravar(lista); }
    },

    marcarPago(id, pago) { gravar(ler().map((x) => (x.id === id ? { ...x, pago } : x))); },
    excluir(id) { gravar(ler().filter((x) => x.id !== id)); },

    // ---- Backup ----
    exportar: () => JSON.stringify({ app: 'FinanFlow', versao: 1, gerado_em: new Date().toISOString(), lancamentos: ler() }, null, 1),
    importar(texto) {
      const d = JSON.parse(texto);
      const lista = Array.isArray(d) ? d : d && d.lancamentos;
      if (!Array.isArray(lista)) throw new Error('ARQUIVO_INVALIDO');
      const validos = lista.filter((l) => l && (l.tipo === 'entrada' || l.tipo === 'saida')
        && /^\d{4}-\d{2}-\d{2}$/.test(l.data) && Number(l.valor) > 0 && l.descricao)
        .map((l) => ({ ...l, id: Number(l.id) || novoId(), valor: Number(l.valor), pago: !!l.pago, categoria: l.categoria || 'Outras' }));
      gravar(validos);
      return validos.length;
    },
    ultimoBackup: () => { try { return localStorage.getItem(KEY + '_backup'); } catch { return null; } },
    marcarBackup: () => { try { localStorage.setItem(KEY + '_backup', new Date().toISOString()); } catch { /* ignora */ } },

    substituir(lista) { gravar(lista); },
    limpar() { gravar([]); },
  };
})();
