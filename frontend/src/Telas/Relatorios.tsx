/**
 * Tela de Relatórios.
 *
 * Gera métricas a partir das atividades carregadas pelo contexto global,
 * permite exportar os dados filtrados em Excel e apresenta um gráfico simples
 * de distribuição por dia.
 */

import axios from "axios";
import { useMemo, useState } from "react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { usePageTitle } from "@/hooks/use-page-title";
import { useActivityContext } from "@/context/ActivityContext";
import { useAuth } from "@/Auth/context/AuthContext";
import { buildApiUrl, resolveApiBaseUrl } from "@/lib/api";
import { getSessionToken } from "@/Auth/utils/sessionStorage";

type PeriodoFiltro = "semana" | "mes" | "todos";
type AgrupamentoSerie = "dia" | "semana" | "mes" | "ano";

type GraficoItem = {
  dia: string;
  qtd: number;
};

type QuantitativoItem = {
  quantidade: number;
};

type StatusResumoItem = QuantitativoItem & {
  status: string;
};

type NivelResumoItem = QuantitativoItem & {
  nivel: string;
};

type FeedbackEntry = {
  id: string;
  subject: string;
  contentHtml: string;
  contentText: string;
  authorEmail: string;
  authorName: string;
  activityId: string | null;
  targetEmail: string | null;
  createdAt: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  Pendente: "Pendente",
  "Concluído": "Concluído",
  "Não Concluído": "Não Concluído",
};

const STATUS_COLORS: Record<string, string> = {
  Pendente: "#f59e0b",
  "Concluído": "#22c55e",
  "Não Concluído": "#ef4444",
};

const NIVEL_COLORS: Record<string, string> = {
  Máximo: "#ef4444",
  Alto: "#f97316",
  Normal: "#2563eb",
  Baixo: "#22c55e",
};

const MILLISECONDS_DAY = 1000 * 60 * 60 * 24;

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR");
}

function getIsoWeek(date: Date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round(diff / (7 * MILLISECONDS_DAY));
}

function buildSerieLabel(date: Date, agrupamento: AgrupamentoSerie) {
  switch (agrupamento) {
    case "dia":
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    case "semana": {
      const week = getIsoWeek(date);
      return `Semana ${week}/${date.getFullYear()}`;
    }
    case "mes":
      return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    case "ano":
      return String(date.getFullYear());
    default:
      return formatDate(date);
  }
}

export default function Relatorios() {
  usePageTitle("Relatórios");

  const { activities, isLoading } = useActivityContext();
  const { sessionUser } = useAuth();
  const apiBaseUrl = resolveApiBaseUrl();
  const isFiscal = sessionUser?.role?.trim().toLowerCase() === "fiscal";
  const [filtro, setFiltro] = useState<PeriodoFiltro>("semana");
  const [agrupamento, setAgrupamento] = useState<AgrupamentoSerie>("dia");
  const [observacoes, setObservacoes] = useState("");

  const atividadesFiltradas = useMemo(() => {
    if (!Array.isArray(activities)) return [];

    const now = Date.now();
    const limite = filtro === "semana" ? 7 : filtro === "mes" ? 30 : Infinity;

    return activities.filter((atividade) => {
      if (limite === Infinity) return true;
      const createdAt = parseDate(atividade.createdAt ?? undefined);
      if (!createdAt) return false;
      const diffDays = (now - createdAt.getTime()) / MILLISECONDS_DAY;
      return diffDays <= limite;
    });
  }, [activities, filtro]);

  const totalAtividades = atividadesFiltradas.length;
  const totalFotos = useMemo(
    () => atividadesFiltradas.filter((atividade) => Boolean(atividade.fotoUrl)).length,
    [atividadesFiltradas],
  );
  const totalFuncionarios = useMemo(() => {
    const nomes = atividadesFiltradas.map((atividade) => atividade.nome?.trim()).filter(Boolean) as string[];
    return new Set(nomes).size;
  }, [atividadesFiltradas]);

  const dadosSerie: GraficoItem[] = useMemo(() => {
    const agrupados = new Map<string, number>();
    atividadesFiltradas.forEach((atividade) => {
      const createdAt = parseDate(atividade.createdAt ?? undefined);
      if (!createdAt) return;
      const label = buildSerieLabel(createdAt, agrupamento);
      agrupados.set(label, (agrupados.get(label) ?? 0) + 1);
    });

    return Array.from(agrupados.entries())
      .map(([dia, qtd]) => ({ dia, qtd }))
      .sort((a, b) => {
        const da = parseDate(a.dia);
        const db = parseDate(b.dia);
        if (!da || !db) return 0;
        return da.getTime() - db.getTime();
      });
  }, [atividadesFiltradas, agrupamento]);

  const serieInsights = useMemo(() => {
    if (!dadosSerie.length) {
      return {
        maior: null,
        menor: null,
        media: 0,
      };
    }

    const maior = dadosSerie.reduce((prev, curr) => (curr.qtd > prev.qtd ? curr : prev), dadosSerie[0]);
    const menor = dadosSerie.reduce((prev, curr) => (curr.qtd < prev.qtd ? curr : prev), dadosSerie[0]);
    const media = Math.round(
      dadosSerie.reduce((acc, item) => acc + item.qtd, 0) / Math.max(dadosSerie.length, 1),
    );

    return { maior, menor, media };
  }, [dadosSerie]);

  const atividadesOrdenadas = useMemo(() => {
    return [...atividadesFiltradas].sort((a, b) => {
      const dateA = parseDate(a.createdAt ?? undefined);
      const dateB = parseDate(b.createdAt ?? undefined);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeB - timeA;
    });
  }, [atividadesFiltradas]);

  const statusResumo: StatusResumoItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    atividadesFiltradas.forEach((atividade) => {
      const status = atividade.status ?? "Pendente";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([status, quantidade]) => ({ status, quantidade }));
  }, [atividadesFiltradas]);

  const nivelResumo: NivelResumoItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    atividadesFiltradas.forEach((atividade) => {
      const nivel = atividade.nivel ?? "Normal";
      counts.set(nivel, (counts.get(nivel) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([nivel, quantidade]) => ({ nivel, quantidade }));
  }, [atividadesFiltradas]);

  const principaisLocais = useMemo(() => {
    const counts = new Map<string, number>();
    atividadesFiltradas.forEach((atividade) => {
      const local = atividade.localPrincipal ?? "Não informado";
      counts.set(local, (counts.get(local) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([local, quantidade]) => ({ local, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
  }, [atividadesFiltradas]);

  // Exporta a visão atual dos relatórios para XLSX (inclui feedbacks e email do autor da atividade).
  const exportarExcel = async () => {
    if (!atividadesOrdenadas.length) return;

    // Mapa auxiliar para armazenar o feedback mais recente por atividade.
    const feedbackMap: Record<string, FeedbackEntry | null> = {};
    const token = getSessionToken();

    if (token) {
      try {
        const feedbackResponses = await Promise.all(
          atividadesOrdenadas.map(async (atividade) => {
            try {
              const { data } = await axios.get<{ feedback: FeedbackEntry | null }>(
                buildApiUrl(`/api/feedbacks/activity/${atividade.id}`, apiBaseUrl),
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              );

              return [atividade.id, data?.feedback ?? null] as const;
            } catch (error) {
              console.warn(`Não foi possível carregar o feedback da atividade ${atividade.id} para exportação.`, error);
              return [atividade.id, null] as const;
            }
          }),
        );

        // Converte as respostas em um objeto indexado pelo ID da atividade.
        feedbackResponses.forEach(([id, feedback]) => {
          feedbackMap[id] = feedback;
        });
      } catch (error) {
        console.warn("Ocorreu um erro ao preparar os feedbacks para exportação.", error);
      }
    } else {
      console.warn("Token ausente ao exportar relatório: feedbacks não serão incluídos.");
    }

    const cabecalhoPeriodo =
      filtro === "todos"
        ? "Todos os registros"
        : filtro === "semana"
          ? "Últimos 7 dias"
          : "Últimos 30 dias";

    const worksheetData: (string | number)[][] = [
      ["Relatório de dashboards"],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      ["Período", cabecalhoPeriodo],
      ["Agrupamento do gráfico", agrupamento],
      ["Total de atividades", totalAtividades],
      ["Registros com foto", totalFotos],
      ["Funcionários envolvidos", totalFuncionarios],
      ["Pontos na série", dadosSerie.length],
      [],
      ["Resumo por status", "Quantidade", "Percentual"],
      ...statusResumo.map((item) => [
        STATUS_LABELS[item.status] ?? item.status,
        item.quantidade,
        `${Math.round((item.quantidade / Math.max(totalAtividades, 1)) * 100)}%`,
      ]),
      [],
      ["Resumo por nível", "Quantidade", "Percentual"],
      ...nivelResumo.map((item) => [
        item.nivel,
        item.quantidade,
        `${Math.round((item.quantidade / Math.max(totalAtividades, 1)) * 100)}%`,
      ]),
      [],
      ["Locais com mais registros", "Quantidade"],
      ...(principaisLocais.length
        ? principaisLocais.map((item, index) => [`${index + 1}. ${item.local}`, item.quantidade])
        : [["Nenhum registro disponível", "--"]]),
    ];

    if (observacoes.trim().length) {
      worksheetData.push([]);
      worksheetData.push(["Anotações do supervisor"]);
      const linhasObs = observacoes.trim().split("\n");
      worksheetData.push(...linhasObs.map((linha) => [linha]));
    }

    worksheetData.push([]);
    worksheetData.push(["Dashboards detalhados"]);
    worksheetData.push(["Data", "Descrição", "Responsável", "Email", "Local", "Sub-locais", "Status", "Feedback"]);

    atividadesOrdenadas.forEach((atividade) => {
      const feedbackEntry = feedbackMap[atividade.id] ?? null;
      // Monta uma string compacta com autor, data e conteúdo do feedback (se existir).
      const feedbackValue = feedbackEntry
        ? [
            feedbackEntry.authorName || feedbackEntry.authorEmail || "Supervisor",
            feedbackEntry.createdAt ? `(${formatDate(new Date(feedbackEntry.createdAt))})` : null,
            feedbackEntry.contentText || feedbackEntry.subject || "",
          ]
            .filter((value): value is string => Boolean(value && value.trim().length))
            .join(" - ")
        : "--";

      worksheetData.push([
        atividade.createdAt ? formatDate(new Date(atividade.createdAt)) : "--",
        atividade.descricaoOriginal ?? atividade.registro ?? "--",
        atividade.nome ?? "--",
        atividade.createdBy ?? "--",
        atividade.localPrincipal ?? "--",
        Array.isArray(atividade.subLocais) ? atividade.subLocais.join(", ") : "--",
        atividade.status ?? "--",
        feedbackValue,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const colCount = worksheetData.reduce((max, row) => Math.max(max, row.length), 0);
    const colWidths = Array.from({ length: colCount }, (_, colIndex) => {
      const maxLen = worksheetData.reduce((max, row) => {
        const value = row[colIndex];
        if (value == null) return max;
        return Math.max(max, String(value).length);
      }, 10);
      return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
    });
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatorio");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, `relatorio-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportarPdf = () => {
    if (!atividadesOrdenadas.length) return;

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Relatório de dashboards", 14, 18);

    let currentY = 28;
    doc.setFontSize(12);

    const metaResumo = [
      `Período: ${filtro === "todos" ? "Todos os registros" : filtro === "semana" ? "Últimos 7 dias" : "Últimos 30 dias"}`,
      `Pontos no gráfico (${agrupamento}): ${dadosSerie.length}`,
      `Total de atividades: ${totalAtividades}`,
      `Registros com foto: ${totalFotos}`,
      `Funcionários envolvidos: ${totalFuncionarios}`,
    ];

    metaResumo.forEach((linha) => {
      doc.text(linha, 14, currentY);
      currentY += 6;
    });

    if (statusResumo.length) {
      doc.text("Distribuição por status:", 14, currentY);
      currentY += 6;
      statusResumo.forEach((item) => {
        doc.text(
          `- ${STATUS_LABELS[item.status] ?? item.status}: ${item.quantidade} (${Math.round(
            (item.quantidade / Math.max(totalAtividades, 1)) * 100,
          )}%)`,
          18,
          currentY,
        );
        currentY += 6;
      });
    }

    if (nivelResumo.length) {
      doc.text("Distribuição por nível:", 14, currentY);
      currentY += 6;
      nivelResumo.forEach((item) => {
        doc.text(
          `- ${item.nivel}: ${item.quantidade} (${Math.round(
            (item.quantidade / Math.max(totalAtividades, 1)) * 100,
          )}%)`,
          18,
          currentY,
        );
        currentY += 6;
      });
    }

    if (principaisLocais.length) {
      doc.text("Locais com mais registros:", 14, currentY);
      currentY += 6;
      principaisLocais.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.local} – ${item.quantidade} registro(s)`, 18, currentY);
        currentY += 6;
      });
    }

    if (observacoes.trim().length) {
      doc.text("Anotações do supervisor:", 14, currentY);
      currentY += 6;
      const linhasObs = doc.splitTextToSize(observacoes.trim(), 260);
      doc.text(linhasObs, 18, currentY);
      currentY += linhasObs.length * 6 + 2;
    }

    doc.addPage();
    doc.text("Listagem detalhada dos dashboards", 14, 18);

    const corpo = atividadesOrdenadas.map((atividade) => [
      atividade.createdAt ? formatDate(new Date(atividade.createdAt)) : "--",
      atividade.descricaoOriginal ?? atividade.registro ?? "--",
      atividade.nome ?? "--",
      atividade.localPrincipal ?? "--",
      Array.isArray(atividade.subLocais) ? atividade.subLocais.join(", ") : "--",
      atividade.status ?? "--",
    ]);

    autoTable(doc, {
      head: [["Data", "Descrição", "Responsável", "Local", "Sub-locais", "Status"]],
      body: corpo,
      startY: 26,
    });

    doc.save(`relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (isFiscal) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
        <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
        <p className="max-w-md text-sm">
          Esta área está disponível apenas para supervisores. Caso precise de um relatório específico, solicite ao seu
          supervisor ou à equipe de coordenação.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Relatórios de Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visualize métricas e exporte um resumo dos dashboards registrados pelos fiscais.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="filtro-periodo" className="text-sm text-muted-foreground">
          Período
        </label>
        <select
          id="filtro-periodo"
          value={filtro}
          onChange={(event) => setFiltro(event.target.value as PeriodoFiltro)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="semana">Últimos 7 dias</option>
          <option value="mes">Últimos 30 dias</option>
          <option value="todos">Todos os registros</option>
        </select>

        <div className="ml-auto flex gap-2">
          <button
            onClick={exportarPdf}
            disabled={!atividadesOrdenadas.length}
            className="inline-flex h-10 items-center rounded-md border border-blue-600 px-4 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar PDF
          </button>

          <button
            onClick={exportarExcel}
            disabled={!atividadesOrdenadas.length}
            className="inline-flex h-10 items-center rounded-md bg-green-600 px-4 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResumoCard titulo="Total de atividades" destaque={totalAtividades} />
        <ResumoCard titulo="Registros com foto" destaque={totalFotos} />
        <ResumoCard titulo="Funcionários envolvidos" destaque={totalFuncionarios} />
        <ResumoCard titulo="Pontos no gráfico" destaque={dadosSerie.length} />
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Dashboards por período</h2>
              <span className="text-xs text-muted-foreground">
                {dadosSerie.length ? `${dadosSerie.length} ponto(s) agregado(s)` : "Sem registros para o período"}
              </span>
            </div>

            <select
              value={agrupamento}
              onChange={(event) => setAgrupamento(event.target.value as AgrupamentoSerie)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="dia">Agrupar por dia</option>
              <option value="semana">Agrupar por semana</option>
              <option value="mes">Agrupar por mês</option>
              <option value="ano">Agrupar por ano</option>
            </select>
          </div>

          <div className="h-[320px]">
            {dadosSerie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosSerie}>
                  <XAxis dataKey="dia" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <CardFallback isLoading={isLoading} mensagemVazia="Nenhuma atividade encontrada para o período selecionado." />
            )}
          </div>

          {dadosSerie.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <InsightBadge
                titulo="Maior volume"
                descricao={
                  serieInsights.maior
                    ? `${serieInsights.maior.dia} (${serieInsights.maior.qtd})`
                    : "—"
                }
              />
              <InsightBadge
                titulo="Menor volume"
                descricao={
                  serieInsights.menor
                    ? `${serieInsights.menor.dia} (${serieInsights.menor.qtd})`
                    : "—"
                }
              />
              <InsightBadge titulo="Média por período" descricao={`${serieInsights.media} atividade(s)`} />
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <ResumoPizza
            titulo="Status das atividades"
            itens={statusResumo}
            getLabel={(item) => STATUS_LABELS[item.status] ?? item.status}
            getColor={(item) => STATUS_COLORS[item.status] ?? "#6b7280"}
          />

          <ResumoPizza
            titulo="Nível das atividades"
            itens={nivelResumo}
            getLabel={(item) => item.nivel}
            getColor={(item) => NIVEL_COLORS[item.nivel] ?? "#6b7280"}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Atividades registradas</h2>

          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Responsável</th>
                  <th className="px-3 py-2">Local</th>
                  <th className="px-3 py-2 text-center">Foto</th>
                </tr>
              </thead>
              <tbody>
                {atividadesOrdenadas.length ? (
                  atividadesOrdenadas.map((atividade) => {
                    const data = atividade.createdAt ? formatDate(new Date(atividade.createdAt)) : "--";
                    const descricao = atividade.descricaoOriginal ?? atividade.registro ?? "--";
                    const responsavel = atividade.nome ?? "--";
                    const local = atividade.localPrincipal ?? "--";
                    const possuiFoto = atividade.fotoUrl ? "Sim" : "Não";

                    return (
                      <tr key={atividade.id} className="border-t last:border-b">
                        <td className="px-3 py-2 align-top text-muted-foreground">{data}</td>
                        <td className="px-3 py-2 align-top">{descricao}</td>
                        <td className="px-3 py-2 align-top">{responsavel}</td>
                        <td className="px-3 py-2 align-top text-muted-foreground">{local}</td>
                        <td className="px-3 py-2 text-center align-top">{possuiFoto}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {isLoading ? "Carregando atividades..." : "Nenhuma atividade encontrada para o período."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold">Locais com mais registros</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Hotspots que concentraram atividades no período filtrado.
            </p>
            <ol className="space-y-2 text-sm">
              {principaisLocais.length ? (
                principaisLocais.map(({ local, quantidade }, index) => (
                  <li key={local} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                    <span className="font-medium text-slate-700">
                      {index + 1}. {local}
                    </span>
                    <span className="text-xs text-muted-foreground">{quantidade} registro(s)</span>
                  </li>
                ))
              ) : (
                <li className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhum registro disponível.
                </li>
              )}
            </ol>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold">Anotações do supervisor</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Registre orientações ou pontos de atenção que a equipe deve acompanhar.
            </p>
            <textarea
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              placeholder="Ex.: Priorizar inspeções no Bloco M durante a próxima semana..."
              className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </aside>
      </section>
    </div>
  );
}

function ResumoCard({ titulo, destaque }: { titulo: string; destaque: number }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="text-3xl font-bold text-foreground">{destaque}</p>
    </div>
  );
}

function InsightBadge({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <p className="text-xs font-medium uppercase text-slate-500">{titulo}</p>
      <p className="text-sm font-semibold text-slate-900">{descricao}</p>
    </div>
  );
}

function ResumoPizza<T extends QuantitativoItem>({
  titulo,
  itens,
  getLabel,
  getColor,
}: {
  titulo: string;
  itens: T[];
  getLabel: (item: T) => string;
  getColor: (item: T) => string;
}) {
  const total = itens.reduce((acc, item) => acc + item.quantidade, 0);

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">{titulo}</h3>
      {total === 0 ? (
        <CardFallback isLoading={false} mensagemVazia="Sem dados para o período selecionado." />
      ) : (
        <>
          <div className="mx-auto h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={itens}
                  dataKey="quantidade"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                >
                  {itens.map((item, index) => (
                    <Cell key={index} fill={getColor(item)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {itens.map((item) => {
              const label = getLabel(item);
              const quantidade = item.quantidade;
              const percentual = total ? Math.round((quantidade / total) * 100) : 0;

              return (
                <li key={label} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-flex h-2 w-2 rounded-full"
                      style={{ backgroundColor: getColor(item) }}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                  <span>{percentual}%</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function CardFallback({ isLoading, mensagemVazia }: { isLoading: boolean; mensagemVazia?: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
      {isLoading ? "Carregando..." : mensagemVazia ?? "Sem dados disponíveis."}
    </div>
  );
}
