import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Interface de dados esperada para o gráfico
interface ChartData {
  fiscal: string;
  registros: number;
}

interface CargaTrabalhoChartProps {
  data: ChartData[];
  className?: string;
}

export function CargaTrabalhoChart({ data, className }: CargaTrabalhoChartProps) {
  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Carga de Trabalho (Registros/Fiscal)</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]"> {/* Altura fixa para o card */}
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {/* Gráfico de barras em layout vertical */}
            <BarChart 
              data={data}
              layout="vertical"
              margin={{ left: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="fiscal" type="category" fontSize="12px" />
              <Tooltip />
              <Bar dataKey="registros" fill="#82ca9d" /> 
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
            Nenhuma carga de trabalho registrada.
          </div>
        )}
      </CardContent>
    </Card>
  );
}