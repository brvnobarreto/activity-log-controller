import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Interface para ambos os tipos de alerta
interface AlertaItem {
  id: string;
  [key: string]: any; // Permite outras chaves
}

interface AlertasListProps {
  title: string;
  headers: string[]; // Ex: ['Local', 'Data']
  items: AlertaItem[];
  keysToShow: string[]; // Ex: ['local', 'data']
  className?: string;
}

export function AlertasList({ title, headers, items, keysToShow, className }: AlertasListProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                {keysToShow.map((key) => (
                  <TableCell key={key}>{item[key]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}