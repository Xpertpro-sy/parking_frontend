/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Durée d’essai en minutes (optionnel). Si absent, essai = 1 mois calendaire. */
  readonly VITE_TRIAL_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
