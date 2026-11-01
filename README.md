# Varejo+ — Gestão da Loja

Sistema local demonstrativo para pequenas lojas e comércios, desenvolvido com HTML, CSS, JavaScript, Python e SQLite.

## Catálogo de demonstração

O projeto inicia com produtos comuns de mercado: arroz, feijão, açúcar, óleo, macarrão, café, frutas, verduras, leite, iogurte, pão, refrigerante, produtos de limpeza e higiene, entre outros.

**Os preços e estoques são ilustrativos.** Edite-os conforme a realidade do estabelecimento antes de utilizar o sistema em uma operação real.

## Funcionalidades

- Cadastro, edição, duplicação, pesquisa e classificação de produtos.
- Frente de caixa com carrinho e seleção de forma de pagamento.
- Preços à vista e preço normal/cartão.
- Descontos, cálculo de troco e finalização da venda.
- Histórico, relatórios, comprovantes e entregas.
- Registros de auditoria e sincronização local com SQLite.

## Como iniciar no Windows

1. Tenha Python instalado com o Python Launcher (`py`).
2. Dê dois cliques em `iniciar_sistema.bat`.
3. O navegador abrirá `http://127.0.0.1:8000` quando o servidor estiver pronto.
4. Mantenha a janela do terminal aberta enquanto utilizar o sistema.

## Estrutura

- `HTML/` — interface.
- `CSS/` — identidade visual e estilos.
- `JavaScript/` — funcionalidades da aplicação.
- `Python/` — servidor local e banco SQLite.
- `Banco de Dados/` — estrutura SQL de referência.

## Dados locais

O catálogo demonstrativo desta versão utiliza uma nova chave de armazenamento no navegador para carregar os produtos de mercado sem apagar o catálogo da versão anterior. Vendas e demais dados existentes permanecem em suas próprias áreas de armazenamento. O banco SQLite é criado dentro da pasta `Python/`.

Projeto pessoal de aprendizado e portfólio. Não é um sistema fiscal e não emite nota fiscal eletrônica.
