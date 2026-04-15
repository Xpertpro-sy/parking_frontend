import { History } from 'lucide-react';

export default function HistoryPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Historique</h1>
        <p className="text-muted-foreground mt-1">Toutes les opérations effectuées</p>
      </div>

      <div className="glass-card p-12 text-center">
        <History className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">Aucune opération enregistrée.</p>
        <p className="text-sm text-muted-foreground mt-1">L'historique s'enrichira au fil des ventes, locations et réparations.</p>
      </div>
    </div>
  );
}
