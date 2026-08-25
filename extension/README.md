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

## Limitações conhecidas (v0.2)

- Suporta apenas a página de venda do vendedor
  (`vendedores.mercadolivre.com.br/vendas/<id>/detalhe`) por enquanto — outros
  marketplaces e a visão de comprador ficam para uma etapa futura.
- A extração (`extractor.js`) foi ajustada com base em uma página real do
  vendedor: número da venda vem da própria URL, SKU e data são lidos por
  busca de padrão no texto da página, e o nome do cliente é a linha logo
  acima da linha com CNPJ/CPF. Se o Mercado Livre mudar o layout e algum
  campo parar de vir certo, esse é o único arquivo que precisa de ajuste.
- Depois de atualizar os arquivos da extensão, clique em **Atualizar** em
  `chrome://extensions` para recarregar (o Chrome não recarrega sozinho).
- O token fica salvo em `chrome.storage.local` (por navegador/perfil, não
  sincroniza entre máquinas).
- Revogar o token na aba **Extensão** do sistema invalida imediatamente o
  acesso da extensão.
