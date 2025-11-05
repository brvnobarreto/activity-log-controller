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

// Interface para os dados (do seu mockData.ts)
interface ChartData {
  fiscal: string;
  registros: number;
}

interface CargaTrabalhoChartProps {
  data: ChartData[];
  className?: string;
}

export function CargaTrabalhoChart({ data, className }: CargaTrabalhoChartProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Carga de Trabalho (Registros/Fiscal)</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]"> {/* Altura fixa para o card */}
        <ResponsiveContainer width="100%" height="100%">
          
          {/* Usamos BarChart (Gráfico de Barras) em vez de LineChart.
            O layout "vertical" coloca os nomes (fiscais) no eixo Y, 
            o que facilita a leitura quando os nomes são longos.
          */}
          <BarChart 
            data={data}
            layout="vertical" // Deixa as barras na horizontal
            margin={{ left: 30 }} // Dá espaço para os nomes dos fiscais
          >
            <CartesianGrid strokeDasharray="3 3" />
            
            {/* Eixo X (horizontal) mostra os números */}
            <XAxis type="number" />
            
            {/* Eixo Y (vertical) mostra as categorias (nomes) */}
            <YAxis dataKey="fiscal" type="category" fontSize="12px" />
            
            <Tooltip />
            
            {/* A Barra que desenha os dados */}
            <Bar dataKey="registros" fill="#82ca9d" /> 
          
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}