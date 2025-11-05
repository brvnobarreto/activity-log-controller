// 2.1: Dados para o Gráfico de Produtividade (Registros por Dia)
export const mockProdutividadeSemanal = [
  { name: 'Seg', registros: 12 },
  { name: 'Ter', registros: 19 },
  { name: 'Qua', registros: 15 },
  { name: 'Qui', registros: 22 },
  { name: 'Sex', registros: 18 },
  { name: 'Sáb', registros: 7 },
  { name: 'Dom', registros: 3 },
];

// 2.2: Dados para o Gráfico de Carga de Trabalho (Registros por Fiscal)
export const mockCargaFiscal = [
  { fiscal: 'João Silva', registros: 45 },
  { fiscal: 'Maria Souza', registros: 32 },
  { fiscal: 'Carlos Lima', registros: 28 },
  { fiscal: 'Ana Costa', registros: 15 },
];

// 3.1: Dados para a Lista de Locais Críticos
export const mockLocaisCriticos = [
  { id: '1', local: 'Bloco D - Banheiro 2º Andar', nivel: 'Máximo', data: '03/11/2025' },
  { id: '2', local: 'Laboratório L05 - Ar Condicionado', nivel: 'Máximo', data: '02/11/2025' },
  { id: '3', local: 'Biblioteca - Vazamento Goteira', nivel: 'Máximo', data: '02/11/2025' },
  { id: '4', local: 'Bloco K - Lâmpada Queimada', nivel: 'Máximo', data: '01/11/2025' },
  { id: '5', local: 'Bloco Z - Lixeira Quebrada', nivel: 'Máximo', data: '31/10/2025' },
];

// 3.2: Dados para a Lista de Pendências Antigas
export const mockPendenciasAntigas = [
  { id: 'R123', fiscal: 'Carlos Lima', local: 'Bloco A - Sala 101', data: '28/10/2025' },
  { id: 'R120', fiscal: 'João Silva', local: 'Ginásio - Bebedouro', data: '28/10/2025' },
  { id: 'R119', fiscal: 'Maria Souza', local: 'Bloco B - Auditório', data: '29/10/2025' },
  { id: 'R115', fiscal: 'Carlos Lima', local: 'Bloco K - Sala 302', data: '30/10/2025' },
  { id: 'R112', fiscal: 'Ana Costa', local: 'Bloco D - Corredor', data: '30/10/2025' },
];