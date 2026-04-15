import { Receipt, FileText } from 'lucide-react';

export default function Receipts() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reçus</h1>
        <p className="text-muted-foreground mt-1">Historique des reçus générés</p>
      </div>

      <div className="glass-card p-12 text-center">
        <Receipt className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">Aucun reçu pour le moment.</p>
        <p className="text-sm text-muted-foreground mt-1">Les reçus seront générés automatiquement lors des ventes et locations.</p>
      </div>
    </div>
  );
}
