import { useMemo } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { ProdutividadeChart } from "@/components/dashboard/ProdutividadeChart";
import { AlertasList } from "@/components/dashboard/AlertasList";
import { CargaTrabalhoChart } from "@/components/dashboard/CargaTrabalhoChart";
import { useActivityContext } from "@/context/ActivityContext";
import type { Atividade, NivelAtividade } from "@/context/ActivityContext";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const WEEKDAY_ORDER = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

const SEVERITY_RANK: Record<NivelAtividade, number> = {
  Baixo: 0,
  Normal: 1,
  Alto: 2,
  Máximo: 3,
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "--";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function buildLocalLabel(activity: Atividade) {
  const principal = activity.localPrincipal?.trim();
  const subLocais = (activity.subLocais ?? [])
    .map((nome) => nome?.trim())
    .filter((nome): nome is string => Boolean(nome));

  if (principal && subLocais.length) {
    return `${principal} - ${subLocais.join(", ")}`;
  }

  if (principal) {
    return principal;
  }

  if (subLocais.length) {
    return subLocais.join(", ");
  }

  return "--";
}

export default function Overview() {
  const { activities, isLoading } = useActivityContext();

  const produtividadeSemanal = useMemo(() => {
    const initialCounts: Record<(typeof WEEKDAY_ORDER)[number], number> = {
      Seg: 0,
      Ter: 0,
      Qua: 0,
      Qui: 0,
      Sex: 0,
      Sáb: 0,
      Dom: 0,
    };

    activities.forEach((activity) => {
      const date = parseDate(activity.createdAt);
      if (!date) return;
      const label = WEEKDAY_LABELS[date.getDay()];
      if (label in initialCounts) {
        initialCounts[label as (typeof WEEKDAY_ORDER)[number]] += 1;
      }
    });

    return WEEKDAY_ORDER.map((label) => ({
      name: label,
      registros: initialCounts[label],
    }));
  }, [activities]);

  const totalRegistrosSemana = useMemo(
    () => produtividadeSemanal.reduce((acc, dia) => acc + dia.registros, 0),
    [produtividadeSemanal]
  );

  const cargaFiscal = useMemo(() => {
    const counts = new Map<string, number>();

    activities.forEach((activity) => {
      const key = activity.nome?.trim() || "Não identificado";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([fiscal, registros]) => ({ fiscal, registros }))
      .sort((a, b) => b.registros - a.registros)
      .slice(0, 8);
  }, [activities]);

  const locaisCriticos = useMemo(() => {
    return activities
      .filter((activity) => activity.nivel === "Máximo" || activity.nivel === "Alto")
      .sort((a, b) => {
        const severityDiff = SEVERITY_RANK[b.nivel] - SEVERITY_RANK[a.nivel];
        if (severityDiff !== 0) {
          return severityDiff;
        }
        const timeA = parseDate(a.createdAt)?.getTime() ?? 0;
        const timeB = parseDate(b.createdAt)?.getTime() ?? 0;
        return timeB - timeA;
      })
      .slice(0, 5)
      .map((activity) => ({
        id: activity.id,
        local: buildLocalLabel(activity),
        nivel: activity.nivel,
        data: formatShortDate(activity.createdAt),
      }));
  }, [activities]);

  const pendenciasAntigas = useMemo(() => {
    return activities
      .filter((activity) => activity.status === "Pendente" || activity.status === "Não Concluído")
      .sort((a, b) => {
        const timeA = parseDate(a.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const timeB = parseDate(b.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      })
      .slice(0, 5)
      .map((activity) => ({
        id: activity.id,
        fiscal: activity.nome,
        local: buildLocalLabel(activity),
        data: formatShortDate(activity.createdAt),
      }));
  }, [activities]);

  const concluidas = useMemo(
    () => activities.filter((activity) => activity.status === "Concluído").length,
    [activities]
  );

  const pendentes = useMemo(
    () =>
      activities.filter((activity) => activity.status === "Pendente" || activity.status === "Não Concluído").length,
    [activities]
  );

  const tempoValidacao = useMemo(() => {
    const durations = activities
      .map((activity) => {
        const created = parseDate(activity.createdAt);
        const updated = parseDate(activity.updatedAt);
        if (!created || !updated || updated.getTime() < created.getTime()) {
          return null;
        }
        return updated.getTime() - created.getTime();
      })
      .filter((value): value is number => value !== null);

    if (durations.length === 0) {
      return "--";
    }

    const avgMs = durations.reduce((acc, value) => acc + value, 0) / durations.length;
    const avgMinutes = Math.round(avgMs / 60000);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;

    if (hours === 0) {
      return `${minutes}min`;
    }

    return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
  }, [activities]);

  const taxaAprovacao = useMemo(() => {
    if (!totalRegistrosSemana) {
      return "0%";
    }
    const perc = Math.round((concluidas / totalRegistrosSemana) * 100);
    return `${perc}%`;
  }, [concluidas, totalRegistrosSemana]);

  const kpiData = useMemo(
    () => ({
      totalRegistros: totalRegistrosSemana,
      taxaAprovacao,
      tempoValidacao,
      pendentes,
    }),
    [pendentes, taxaAprovacao, tempoValidacao, totalRegistrosSemana]
  );

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold p-4 md:p-6">Visão Geral (Supervisão)</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 p-4 md:gap-6">
        <h2 className="text-xl md:text-2xl font-semibold mb-4 col-span-full">Indicadores de Performance</h2>
        <KPICard
          title="Total de Registros (Semana)"
          value={kpiData.totalRegistros}
          description={isLoading ? "Carregando..." : "+15% vs. semana anterior"}
        />
        <KPICard title="Taxa de Aprovação" value={isLoading ? "--" : kpiData.taxaAprovacao} />
        <KPICard title="Tempo Médio de Validação" value={isLoading ? "--" : kpiData.tempoValidacao} />
        <KPICard
          title="Registros Pendentes"
          value={kpiData.pendentes}
          description={isLoading ? "Carregando..." : "Ação necessária"}
        />

        <h2 className="text-xl md:text-2xl font-semibold mb-4 col-span-full">Tendências e Distribuição</h2>
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <ProdutividadeChart data={produtividadeSemanal} />
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-1">
          <CargaTrabalhoChart data={cargaFiscal} />
        </div>

        <h2 className="text-xl md:text-2xl font-semibold mb-4 col-span-full">Alertas e Foco Crítico</h2>
        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <AlertasList
            title="Top Locais Críticos (Nível Alto ou Máximo)"
            headers={["Local", "Nível", "Data"]}
            items={locaisCriticos}
            keysToShow={["local", "nivel", "data"]}
          />
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <AlertasList
            title="Pendências Mais Antigas"
            headers={["Fiscal", "Local", "Data do Registro"]}
            items={pendenciasAntigas}
            keysToShow={["fiscal", "local", "data"]}
          />
        </div>
      </div>
    </div>
  );
}