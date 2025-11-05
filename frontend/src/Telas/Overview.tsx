// 1. Importe o CSS do Grid
import './Overview.css';

// 2. Importe os componentes do Dashboard
import { KPICard } from '@/components/dashboard/KPICard';
import { ProdutividadeChart } from '@/components/dashboard/ProdutividadeChart';
import { AlertasList } from '@/components/dashboard/AlertasList';
// Importação do CargaTrabalhoChart
import { CargaTrabalhoChart } from '@/components/dashboard/CargaTrabalhoChart'; // <-- ALTERAÇÃO: Linha adicionada

// 3. Importe os Dados Mockados
import { 
  mockProdutividadeSemanal, 
  mockCargaFiscal, // Agora este será usado ativamente
  mockLocaisCriticos, 
  mockPendenciasAntigas 
} from '@/components/dashboard/mockData';

export default function Overview() {
  // No futuro, estes dados virão de uma API/Firebase (useState, useEffect)
  
  // Dados mockados para os KPIs (Seção 1)
  const kpiData = {
    totalRegistros: "75", // (Ex: na última semana)
    taxaAprovacao: "92%",
    tempoValidacao: "4h 15min",
    pendentes: "8",
  };

  return (
    <div>
      <h1 className="text-3xl font-bold p-6">Visão Geral (Supervisão)</h1>

      <div className="dashboard-grid">
        
        {/* --- Seção 1: Indicadores de Performance --- */}
        <h2 className="section-title">Indicadores de Performance</h2>
        <KPICard 
          title="Total de Registros (Semana)" 
          value={kpiData.totalRegistros} 
          description="+15% vs. semana anterior" 
        />
        <KPICard 
          title="Taxa de Aprovação" 
          value={kpiData.taxaAprovacao} 
        />
        <KPICard 
          title="Tempo Médio de Validação" 
          value={kpiData.tempoValidacao} 
        />
        <KPICard 
          title="Registros Pendentes" 
          value={kpiData.pendentes} 
          description="Ação necessária" 
        />

        {/* --- Seção 2: Tendências e Distribuição --- */}
        <h2 className="section-title">Tendências e Distribuição</h2>
        <ProdutividadeChart data={mockProdutividadeSemanal} />
        
        {/* Renderização do CargaTrabalhoChart */}
        {/* <-- ALTERAÇÃO: Bloco de código descomentado e classe aplicada --> */}
        <CargaTrabalhoChart 
          data={mockCargaFiscal} 
          className="chart-carga-trabalho" 
        />

        {/* --- Seção 3: Alertas e Foco Crítico --- */}
        <h2 className="section-title">Alertas e Foco Crítico</h2>
        <AlertasList 
          title="Top 5 Locais Críticos (Nível Máximo)"
          headers={['Local', 'Nível', 'Data']}
          items={mockLocaisCriticos}
          keysToShow={['local', 'nivel', 'data']}
          className="list-locais-criticos"
        />
        <AlertasList 
          title="Top 5 Pendências Antigas"
          headers={['Fiscal', 'Local', 'Data do Registro']}
          items={mockPendenciasAntigas}
          keysToShow={['fiscal', 'local', 'data']}
          className="list-pendencias"
        />
      </div>
    </div>
  );
}