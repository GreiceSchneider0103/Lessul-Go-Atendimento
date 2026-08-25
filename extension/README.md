# Lessul Go — Extensão de importação do Mercado Livre

Extensão Chrome (Manifest V3) que lê os dados do pedido na página de venda do
Mercado Livre e abre um ticket pré-preenchido no Lessul Go, sem precisar
digitar tudo manualmente.

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions`.
2. Ative "Modo do desenvolvedor" (canto superior direito).
3. Clique em "Carregar sem compactação" e selecione esta pasta (`extension/`).

## Como configurar

1. No sistema, acesse **Extensão** no menu lateral e clique em **Gerar
   token**. Copie o token exibido (ele só aparece uma vez).
2. Clique no ícone da extensão no Chrome → **Configurar token** (ou clique
   com o botão direito no ícone → Opções).
3. Cole o token e confirme o endereço do sistema (já vem preenchido com o
   endereço de produção). Clique em **Salvar**.

## Como usar

1. Abra a página de detalhe de uma venda no Mercado Livre.
2. Um botão flutuante **"Importar para o Lessul Go"** aparece no canto
   inferior direito da página. Clique nele.
   - Alternativa: clique no ícone da extensão e em **"Importar pedido desta
     página"** — funciona mesmo se o botão flutuante não aparecer.
3. Uma nova aba abre em `/tickets/new` com os campos já preenchidos. Revise
   e complete o restante do formulário normalmente antes de salvar — nenhum
   ticket é criado automaticamente, apenas o rascunho é pré-preenchido.

## Limitações conhecidas (v0.1)

- Suporta apenas Mercado Livre por enquanto (outros marketplaces ficam para
  uma etapa futura).
- A extração de dados (`extractor.js`) usa correspondência por texto de
  rótulo (ex.: "Comprador", "Número da venda") em vez de seletores de CSS,
  para não quebrar a cada mudança de layout do Mercado Livre — mas **não foi
  validada contra uma página real logada**, já que o ambiente de build não
  tem acesso a uma sessão de vendedor autenticada. Ao testar pela primeira
  vez, se algum campo vier vazio ou errado, ajuste as listas de rótulos em
  `extractor.js` (funções `findValueByLabel`) com o texto exato visto na
  página — é o único lugar que precisa mudar.
- O token fica salvo em `chrome.storage.local` (por navegador/perfil, não
  sincroniza entre máquinas).
- Revogar o token na aba **Extensão** do sistema invalida imediatamente o
  acesso da extensão.
