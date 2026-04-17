import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

type FullscreenLoaderProps = {
  message?: string;
};

export default function FullscreenLoader({ message = 'Traitement en cours...' }: FullscreenLoaderProps) {
  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md">
      <div className="relative flex min-w-[220px] flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-6 py-5 shadow-2xl">
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-primary/20" />
        <div className="relative flex items-center justify-center">
          <span className="absolute h-14 w-14 rounded-full border-2 border-primary/20" />
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">Veuillez patienter...</p>
      </div>
    </div>
  );
}
