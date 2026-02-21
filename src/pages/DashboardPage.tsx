import { Building2 } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Building2 className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Em construção — funcionalidades em breve.</p>
    </div>
  );
}
