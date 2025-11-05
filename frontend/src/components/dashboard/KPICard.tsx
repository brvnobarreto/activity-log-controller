import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface KPICardProps {
  title: string;
  value: string;
  description?: string;
  className?: string; // Para o CSS Grid
}

export function KPICard({ title, value, description, className }: KPICardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}