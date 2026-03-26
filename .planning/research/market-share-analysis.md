# Research: Market Share Data Integration

## Contexto Atual
O módulo de Market Share (`MarketShare.tsx`) utiliza dados da tabela `market_share_data` do Supabase para calcular a participação da Alcon no mercado privado paraguaio.

## Descobertas Técnicas
- **Tabela Principal**: `market_share_data` (atualmente não visível no `types.ts`, mas referenciada no código).
- **Campos Esperados**: 
  - `anio` (Ano)
  - `mes` (Mês, sendo `0` para o total anual)
  - `total_cirurgias_pais`
  - `total_monofocals_mercado`
  - `total_atiols_mercado`
  - `target_share_monofocal`
  - `target_share_atiol`
  - `fuente`
- **Lógica de Filtro**: O sistema exclui automaticamente dados de vendas marcados como "público", "publico" ou "CONOFTA" para garantir que o Share seja calculado apenas sobre o mercado privado.
- **Estacionalidade**: O código possui um objeto `SEASONAL_WEIGHTS` fixo para distribuir o mercado anual pelos meses quando não há dados mensais detalhados.

## Pontos de Melhoria Identificados
1. **Sincronização de Tipos**: A tabela `market_share_data` precisa ser validada ou adicionada formalmente ao esquema se houver instabilidade no carregamento.
2. **Visualização Competitiva**: Adicionar gráficos que mostrem a evolução do "Gap" em relação à meta de forma mais proeminente.
3. **Integração de Dados Externos**: Facilitar a importação de dados de fontes como SUCEV ou IMS diretamente via Excel, similar ao que é feito no dashboard de vendas.

## Próximos Passos de Implementação
- [ ] Criar interface de importação simplificada para dados de mercado.
- [ ] Implementar visualização de "Tendência de Share" de 12 meses móveis.
- [ ] Adicionar exportação de PDF do relatório de Market Share.
