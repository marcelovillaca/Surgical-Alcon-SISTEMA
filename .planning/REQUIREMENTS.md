# Requirements: Surgical Alcon SISTEMA

## Core Requirements (v1 - Current)
- [x] **Autenticação**: Sistema de login via Supabase.
- [x] **Gestão de Layout**: AppLayout com navegação lateral.
- [x] **CRM**: Cadastro e visualização de clientes/contas.
- [x] **Inventário**: Listagem e filtros de produtos.
- [x] **Pedidos**: Registro de ordens de venda.
- [x] **Visitas**: Calendário e registro de visitas a clientes.
- [x] **Vendas & Metas**: Dashboard de acompanhamento de targets.
- [x] **Conofta**: Painel específico para o canal público.
- [x] **Auditoria**: Registro automático de alterações sensíveis.

## Proximas Prioridades (Backlog)
- [ ] **Logística**: Implementar módulo de expedição e gestão de rotas de entrega.
- [ ] **Configuração RBAC**: Implementar controle de acesso baseado em cargos e permissões.
- [ ] **Relatórios Avançados**: Exportação de dados em Excel/PDF para reuniões gerenciais.
- [ ] **Análise de Contas**: Refinamento das métricas de rentabilidade por cliente.
- [ ] **Market Share**: Finalizar visualizações de comparação competitiva.

## Constraints
- **Performance**: Dashboard deve carregar rapidamente mesmo com grandes volumes de dados de vendas.
- **Responsividade**: Essencial para uso em tablets pela equipe de campo.
- **Segurança**: Dados sensíveis de metas devem ser restritos conforme o cargo.
