// Importe os componentes do Dashboard
import { KPICard } from '@/components/dashboard/KPICard';
import { ProdutividadeChart } from '@/components/dashboard/ProdutividadeChart';
import { AlertasList } from '@/components/dashboard/AlertasList';
import { CargaTrabalhoChart } from '@/components/dashboard/CargaTrabalhoChart';

// Importe os Dados Mockados  
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

      <div className="grid grid-cols-4 gap-6 p-6">
        
        {/* --- Seção 1: Indicadores de Performance --- */}
        <h2 className="text-2xl font-semibold mb-4 col-span-full">Indicadores de Performance</h2>
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
        <h2 className="text-2xl font-semibold mb-4 col-span-full">Tendências e Distribuição</h2>
        <div className="col-span-3">
          <ProdutividadeChart data={mockProdutividadeSemanal} />
        </div>
        <CargaTrabalhoChart 
          data={mockCargaFiscal} 
          className="col-span-1" 
        />

        {/* --- Seção 3: Alertas e Foco Crítico --- */}
        <h2 className="text-2xl font-semibold mb-4 col-span-full">Alertas e Foco Crítico</h2>
        <AlertasList 
          title="Top 5 Locais Críticos (Nível Máximo)"
          headers={['Local', 'Nível', 'Data']}
          items={mockLocaisCriticos}
          keysToShow={['local', 'nivel', 'data']}
          className="col-span-2"
        />
        <AlertasList 
          title="Top 5 Pendências Antigas"
          headers={['Fiscal', 'Local', 'Data do Registro']}
          items={mockPendenciasAntigas}
          keysToShow={['fiscal', 'local', 'data']}
          className="col-span-2"
        />
      </div>
    </div>
  );
}