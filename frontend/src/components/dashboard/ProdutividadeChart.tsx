import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ChartData {
  name: string;
  registros: number;
}

export function ProdutividadeChart({ data }: { data: ChartData[] }) {
  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <Card className="chart-produtividade">
      <CardHeader>
        <CardTitle>Produtividade (Registros/Dia)</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="registros" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
            Nenhum dado de produtividade disponível.
          </div>
        )}
      </CardContent>
    </Card>
  );
}