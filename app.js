// Tela do FinanFlow: resumo do mês, gráficos, lista, formulário e backup.

const hojeYmd = () => ymd(new Date());
let ano = new Date().getFullYear();
let mes = new Date().getMonth(); // 0-11
let historico = [];  // últimos 6 meses (para o gráfico)
let itens = [];      // só o mês escolhido
let atrasados = [];
let filtro = 'todos';
let editando = null; // lançamento em edição

// ---------- Tela inicial ----------
function carregar() {
  const vazio = Dados.total() === 0;
  $('#boas-vindas').hidden = !vazio;
  $('#painel').hidden = vazio;
  $('#novo-topo').hidden = vazio;
  if (vazio) return;

  $('#titulo-mes').textContent = `${MESES[mes].charAt(0).toUpperCase() + MESES[mes].slice(1)} ${ano}`;
  const fim = fimDoMes(ano, mes);
  const ini = ymd(new Date(ano, mes, 1));
  historico = Dados.listar(ymd(new Date(ano, mes - 5, 1)), fim);
  atrasados = Dados.atrasados(hojeYmd());
  itens = historico.filter((l) => l.data >= ini);
  render();
}

function mudarMes(delta) {
  const d = new Date(ano, mes + delta, 1);
  ano = d.getFullYear(); mes = d.getMonth();
  carregar();
}
$('#ant').onclick = () => mudarMes(-1);
$('#prox').onclick = () => mudarMes(1);
$('#hoje').onclick = () => { ano = new Date().getFullYear(); mes = new Date().getMonth(); carregar(); };

// ---------- Desenho da tela ----------
const soma = (l) => l.reduce((s, x) => s + x.valor, 0);

function render() {
  const ent = itens.filter((l) => l.tipo === 'entrada');
  const sai = itens.filter((l) => l.tipo === 'saida');
  const entPago = soma(ent.filter((l) => l.pago)), entPend = soma(ent.filter((l) => !l.pago));
  const saiPago = soma(sai.filter((l) => l.pago)), saiPend = soma(sai.filter((l) => !l.pago));
  const saldo = entPago - saiPago;
  const previsto = saldo + entPend - saiPend;

  $('#s-ent').textContent = brl(entPago);
  $('#s-ent-p').textContent = entPend ? `+ ${brl(entPend)} a receber` : 'nada a receber';
  $('#s-sai').textContent = brl(saiPago);
  $('#s-sai-p').textContent = saiPend ? `+ ${brl(saiPend)} a pagar` : 'nada a pagar';
  $('#s-saldo').textContent = brl(saldo);
  $('#s-saldo').classList.toggle('neg', saldo < 0);
  $('#s-prev').textContent = `previsto no fim do mês: ${brl(previsto)}`;

  renderAtrasados();
  renderCategorias(sai);
  renderComparativo();
  renderLista();
  renderBackup();
}

function renderAtrasados() {
  const box = $('#atrasados');
  if (!atrasados.length) { box.hidden = true; return; }
  const pagar = atrasados.filter((l) => l.tipo === 'saida'), receber = atrasados.filter((l) => l.tipo === 'entrada');
  const partes = [];
  if (pagar.length) partes.push(`<b>${pagar.length}</b> ${pagar.length > 1 ? 'contas vencidas' : 'conta vencida'} (${brl(soma(pagar))})`);
  if (receber.length) partes.push(`<b>${receber.length}</b> ${receber.length > 1 ? 'valores atrasados' : 'valor atrasado'} para receber (${brl(soma(receber))})`);
  box.innerHTML = `⏰ ${partes.join(' e ')}. <button class="link-btn" id="ver-atrasados">Ver</button>`;
  box.hidden = false;
  $('#ver-atrasados').onclick = () => {
    const d = parseYmd(atrasados[0].data);
    ano = d.getFullYear(); mes = d.getMonth(); filtro = 'pendente';
    marcarAba(); carregar();
    $('#lista').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

function renderCategorias(sai) {
  const total = soma(sai);
  if (!total) { $('#categorias').innerHTML = '<p class="vazio">Nenhuma saída neste mês.</p>'; return; }
  const porCat = {};
  sai.forEach((l) => { porCat[l.categoria] = (porCat[l.categoria] || 0) + l.valor; });
  const linhas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const maior = linhas[0][1];
  $('#categorias').innerHTML = linhas.map(([cat, v]) => `
    <div class="barra-cat">
      <div class="barra-rotulo"><span>${esc(cat)}</span><b>${brl(v)} <small>${Math.round(v / total * 100)}%</small></b></div>
      <div class="barra-trilho"><div class="barra-cheia" style="width:${(v / maior * 100).toFixed(1)}%"></div></div>
    </div>`).join('');
}

function renderComparativo() {
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ano, mes - i, 1);
    const ini = ymd(d), fim = fimDoMes(d.getFullYear(), d.getMonth());
    const doMes = historico.filter((l) => l.data >= ini && l.data <= fim);
    meses.push({
      nome: MESES[d.getMonth()].slice(0, 3),
      ent: soma(doMes.filter((l) => l.tipo === 'entrada')),
      sai: soma(doMes.filter((l) => l.tipo === 'saida')),
    });
  }
  const maior = Math.max(1, ...meses.map((m) => Math.max(m.ent, m.sai)));
  $('#comparativo').innerHTML = `
    <div class="colunas">
      ${meses.map((m) => `
        <div class="coluna" title="${m.nome}: entradas ${brl(m.ent)} · saídas ${brl(m.sai)}">
          <div class="pares">
            <div class="c-ent" style="height:${(m.ent / maior * 100).toFixed(1)}%"></div>
            <div class="c-sai" style="height:${(m.sai / maior * 100).toFixed(1)}%"></div>
          </div>
          <span>${m.nome}</span>
        </div>`).join('')}
    </div>
    <div class="legenda"><span><i class="c-ent"></i> Entradas</span><span><i class="c-sai"></i> Saídas</span></div>`;
}

function renderLista() {
  const q = $('#busca').value.trim().toLowerCase();
  const hoje = hojeYmd();
  const lista = itens.filter((l) =>
    (filtro === 'todos' || (filtro === 'pendente' ? !l.pago : l.tipo === filtro)) &&
    (!q || `${l.descricao} ${l.categoria} ${l.forma || ''} ${l.observacao || ''}`.toLowerCase().includes(q)));

  if (!lista.length) {
    $('#lista').innerHTML = `<p class="vazio">${itens.length ? 'Nada encontrado com esse filtro.' : 'Nenhum lançamento neste mês.'}</p>`;
    return;
  }
  $('#lista').innerHTML = lista.map((l) => {
    const atrasado = !l.pago && l.data < hoje;
    const badge = l.pago ? '' : `<span class="badge ${atrasado ? 'atrasado' : ''}">${atrasado ? 'Atrasado' : l.tipo === 'saida' ? 'A pagar' : 'A receber'}</span>`;
    return `
      <article class="item ${l.tipo} ${l.pago ? '' : 'pendente'}">
        <div class="item-data">${dataCurta(l.data)}</div>
        <div class="item-info">
          <strong>${esc(l.descricao)} ${badge}</strong>
          <span>${esc(l.categoria)}${l.forma ? ' · ' + esc(l.forma) : ''}${l.observacao ? ' · ' + esc(l.observacao) : ''}</span>
        </div>
        <div class="item-valor">${l.tipo === 'saida' ? '−' : '+'} ${brl(l.valor)}</div>
        <div class="item-acoes">
          <button data-acao="pago" data-id="${l.id}" title="${l.pago ? 'Voltar para pendente' : 'Marcar como pago'}" aria-label="${l.pago ? 'Voltar para pendente' : 'Marcar como pago'}">${l.pago ? '↺' : '✓'}</button>
          <button data-acao="editar" data-id="${l.id}" title="Editar" aria-label="Editar">✎</button>
          <button data-acao="excluir" data-id="${l.id}" title="Excluir" aria-label="Excluir">🗑</button>
        </div>
      </article>`;
  }).join('');
}

// ---------- Filtros ----------
function marcarAba() {
  document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativo', b.dataset.f === filtro));
}
document.querySelector('.abas').onclick = (e) => {
  const b = e.target.closest('button[data-f]'); if (!b) return;
  filtro = b.dataset.f; marcarAba(); renderLista();
};
$('#busca').oninput = renderLista;

// ---------- Ações da lista ----------
$('#lista').onclick = (e) => {
  const b = e.target.closest('button[data-acao]'); if (!b) return;
  const l = itens.find((x) => String(x.id) === b.dataset.id); if (!l) return;
  if (b.dataset.acao === 'editar') return abrirForm(l);
  if (b.dataset.acao === 'pago') Dados.marcarPago(l.id, !l.pago);
  if (b.dataset.acao === 'excluir') {
    if (!confirm(`Excluir "${l.descricao}"?`)) return;
    Dados.excluir(l.id);
  }
  carregar();
};

// ---------- Formulário ----------
const dlg = $('#dlg');
$('#f-forma').innerHTML = '<option value="">—</option>' + FORMAS.map((f) => `<option>${esc(f)}</option>`).join('');

function preencherCategorias(tipo, atual) {
  const cats = CATEGORIAS[tipo];
  const lista = atual && !cats.includes(atual) ? [...cats, atual] : cats;
  $('#f-cat').innerHTML = lista.map((c) => `<option${c === atual ? ' selected' : ''}>${esc(c)}</option>`).join('');
  $('#f-pago-txt').textContent = tipo === 'entrada' ? 'Já foi recebido' : 'Já foi pago';
}
document.querySelectorAll('input[name=tipo]').forEach((r) => {
  r.onchange = () => preencherCategorias(r.value);
});

function abrirForm(l = null) {
  editando = l;
  $('#dlg-titulo').textContent = l ? 'Editar lançamento' : 'Novo lançamento';
  const tipo = l ? l.tipo : 'saida';
  document.querySelector(`input[name=tipo][value=${tipo}]`).checked = true;
  preencherCategorias(tipo, l && l.categoria);
  $('#f-desc').value = l ? l.descricao : '';
  $('#f-valor').value = l ? l.valor.toFixed(2).replace('.', ',') : '';
  const hoje = new Date();
  const padrao = (hoje.getFullYear() === ano && hoje.getMonth() === mes) ? hojeYmd() : ymd(new Date(ano, mes, 1));
  $('#f-data').value = l ? l.data : padrao;
  $('#f-forma').value = l ? (l.forma || '') : '';
  $('#f-pago').checked = l ? l.pago : true;
  $('#f-obs').value = l ? (l.observacao || '') : '';
  $('#f-rep').value = '1';
  $('#repetir-box').hidden = !!l;
  $('#erro-form').textContent = '';
  dlg.showModal();
  $('#f-desc').focus();
}
$('#novo').onclick = () => abrirForm();
$('#novo-topo').onclick = () => abrirForm();
$('#bv-comecar').onclick = () => abrirForm();
$('#cancelar').onclick = () => dlg.close();

// Mesmo dia em outro mês (31/01 + 1 mês = 28/02)
function somarMeses(s, n) {
  const d = parseYmd(s);
  const alvo = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d.getDate(), ultimo));
  return ymd(alvo);
}

$('#form-l').onsubmit = (e) => {
  e.preventDefault();
  const valor = lerValor($('#f-valor').value);
  if (!(valor > 0)) { $('#erro-form').textContent = 'Digite um valor maior que zero (ex.: 49,90).'; $('#f-valor').focus(); return; }
  const base = {
    id: editando ? editando.id : null,
    tipo: document.querySelector('input[name=tipo]:checked').value,
    descricao: $('#f-desc').value.trim(),
    valor,
    categoria: $('#f-cat').value,
    forma: $('#f-forma').value,
    data: $('#f-data').value,
    pago: $('#f-pago').checked,
    observacao: $('#f-obs').value.trim(),
  };
  if (!base.descricao || !base.data) { $('#erro-form').textContent = 'Preencha a descrição e a data.'; return; }
  const vezes = editando ? 1 : Number($('#f-rep').value);
  for (let i = 0; i < vezes; i++) {
    Dados.salvar({
      ...base,
      data: somarMeses(base.data, i),
      pago: i === 0 ? base.pago : false, // os meses seguintes começam pendentes
      descricao: vezes > 1 ? `${base.descricao} (${i + 1}/${vezes})` : base.descricao,
    });
  }
  if (Dados.semArmazenamento) { $('#erro-form').textContent = 'Este navegador não deixou salvar (modo anônimo?).'; return; }
  dlg.close();
  // vai para o mês do lançamento, para a pessoa ver o que acabou de salvar
  const d = parseYmd(base.data); ano = d.getFullYear(); mes = d.getMonth();
  carregar();
};

// ---------- Planilha (CSV que abre no Excel) ----------
$('#csv').onclick = () => {
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Forma', 'Valor', 'Situação', 'Observação']];
  [...itens].sort((a, b) => a.data.localeCompare(b.data)).forEach((l) => linhas.push([
    `${dataCurta(l.data)}/${l.data.slice(0, 4)}`, l.tipo === 'entrada' ? 'Entrada' : 'Saída', l.descricao, l.categoria,
    l.forma || '', (l.tipo === 'saida' ? -l.valor : l.valor).toFixed(2).replace('.', ','),
    l.pago ? 'Pago' : 'Pendente', l.observacao || '',
  ]));
  baixar(`FinanFlow-${ano}-${pad(mes + 1)}.csv`, '﻿' + linhas.map((r) => r.map(cel).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
};

function baixar(nome, conteudo, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Backup ----------
function renderBackup() {
  const ult = Dados.ultimoBackup();
  const dias = ult ? Math.floor((Date.now() - new Date(ult)) / 86400000) : null;
  $('#info-backup').textContent = ult
    ? `Último backup: ${new Date(ult).toLocaleDateString('pt-BR')}${dias ? ` (há ${dias} dia${dias > 1 ? 's' : ''})` : ' (hoje)'}.`
    : 'Você ainda não fez nenhum backup.';
  const aviso = $('#aviso');
  if (Dados.total() >= 10 && (dias === null || dias >= 7)) {
    aviso.innerHTML = `💾 ${ult ? `Seu último backup foi há ${dias} dias.` : 'Você ainda não tem backup.'} <button class="link-btn" id="aviso-backup">Baixar agora</button>`;
    aviso.hidden = false;
    $('#aviso-backup').onclick = fazerBackup;
  } else aviso.hidden = true;
}

function fazerBackup() {
  baixar(`FinanFlow-backup-${hojeYmd()}.json`, Dados.exportar(), 'application/json');
  Dados.marcarBackup();
  renderBackup();
}
$('#backup').onclick = fazerBackup;

const abrirArquivo = () => { $('#arquivo').value = ''; $('#arquivo').click(); };
$('#restaurar').onclick = abrirArquivo;
$('#bv-restaurar').onclick = abrirArquivo;
$('#arquivo').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (Dados.total() && !confirm('Restaurar este backup? Os lançamentos que estão aqui agora serão substituídos pelos do arquivo.')) return;
  try {
    const n = Dados.importar(await f.text());
    alert(`Backup restaurado: ${n} lançamento${n === 1 ? '' : 's'}.`);
    ano = new Date().getFullYear(); mes = new Date().getMonth();
    carregar();
  } catch (err) {
    console.error(err);
    alert('Este arquivo não é um backup do FinanFlow.');
  }
};

$('#apagar').onclick = () => {
  if (!confirm('Apagar TODOS os lançamentos deste aparelho? Isso não tem volta, a não ser que você tenha um backup.')) return;
  if (!confirm('Tem certeza? Clique em OK para apagar tudo.')) return;
  Dados.limpar();
  carregar();
};

// ---------- Dados de exemplo ----------
$('#bv-exemplo').onclick = () => { Dados.substituir(gerarExemplo()); carregar(); };

function gerarExemplo() {
  const lista = [];
  let id = 1;
  const hoje = new Date();
  const add = (d, tipo, descricao, valor, categoria, forma, pago) =>
    lista.push({ id: id++, tipo, descricao, valor, categoria, forma, data: ymd(d), pago, observacao: '' });
  const r = (min, max) => Math.round(min + Math.random() * (max - min));
  for (let m = 5; m >= 0; m--) {
    const base = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1);
    const dia = (n) => new Date(base.getFullYear(), base.getMonth(), n);
    const pago = (n) => m > 0 || n <= hoje.getDate();
    add(dia(5), 'entrada', 'Salário', 3800, 'Salário', 'Transferência', pago(5));
    add(dia(18), 'entrada', 'Freela de design', r(300, 900), 'Serviços / freelas', 'Pix', pago(18));
    add(dia(6), 'saida', 'Aluguel', 1200, 'Moradia', 'Boleto', pago(6));
    add(dia(8), 'saida', 'Mercado do mês', r(450, 700), 'Mercado', 'Cartão de débito', pago(8));
    add(dia(10), 'saida', 'Conta de luz', r(110, 190), 'Contas (água, luz, internet)', 'Pix', pago(10));
    add(dia(10), 'saida', 'Internet', 100, 'Contas (água, luz, internet)', 'Boleto', pago(10));
    add(dia(12), 'saida', 'Combustível', r(180, 320), 'Transporte', 'Cartão de crédito', pago(12));
    add(dia(14), 'saida', 'Streaming', 45, 'Assinaturas', 'Cartão de crédito', pago(14));
    add(dia(16), 'saida', 'Restaurante', r(60, 180), 'Alimentação fora', 'Pix', pago(16));
    add(dia(20), 'saida', 'Farmácia', r(40, 120), 'Saúde', 'Cartão de débito', pago(20));
    add(dia(22), 'saida', 'Cinema', r(50, 90), 'Lazer', 'Pix', pago(22));
    add(dia(25), 'saida', 'Curso online', 89, 'Educação', 'Cartão de crédito', pago(25));
  }
  // uma conta vencida de propósito, para mostrar o alerta
  const venc = new Date(hoje); venc.setDate(venc.getDate() - 2);
  add(venc, 'saida', 'Boleto do celular', 59, 'Contas (água, luz, internet)', 'Boleto', false);
  return lista;
}

carregar();
