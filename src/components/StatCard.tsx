import { Loader2, LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  isLoading?: boolean;
}

export default function StatCard({ label, value, icon: Icon, accent, isLoading = false }: StatCardProps) {
  const bg = accent || 'bg-primary/10';
  return (
    <div className={`${bg} border border-border/30 rounded-xl p-5 animate-fade-in`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-background/40`}>
          <Icon className={`w-5 h-5 ${accent ? 'text-foreground' : 'text-primary'}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden /> : value}
      </p>
    </div>
  );
}
