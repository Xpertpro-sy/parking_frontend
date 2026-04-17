import { ChangeEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Type } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { uploadImageToR2 } from "@/lib/cloudflare-upload";
import {
  BrandingConfig,
  brandingSettingsQueryKey,
  getBrandingSettingsRequest,
  resetBrandingSettingsRequest,
  saveBrandingImageRequest,
  saveBrandingTextRequest,
} from "@/lib/branding-api";

const MIN_LOGO_DIMENSION = 120;

const DEFAULT_BRANDING: BrandingConfig = {
  mode: "text",
  text: "AutoParc",
  imageDataUrl: null,
  imageScale: 100,
};

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [textDraft, setTextDraft] = useState(DEFAULT_BRANDING.text);
  const [pendingImageSource, setPendingImageSource] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImageScale, setPendingImageScale] = useState(100);
  const [savingImage, setSavingImage] = useState(false);

  const { data: brandingData = DEFAULT_BRANDING } = useQuery({
    queryKey: [...brandingSettingsQueryKey, user?.email ?? "anonymous"],
    queryFn: getBrandingSettingsRequest,
    enabled: Boolean(user?.email),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    setBranding(brandingData);
    setTextDraft(brandingData.text);
    setPendingImageScale(brandingData.imageScale);
  }, [brandingData]);

  const handleTextSave = () => {
    if (!user?.email) return;
    const text = textDraft.trim();
    if (!text) {
      toast.error("Le texte du logo ne peut pas être vide.");
      return;
    }
    void (async () => {
      try {
        await saveBrandingTextRequest({ text });
        await queryClient.invalidateQueries({ queryKey: brandingSettingsQueryKey });
        toast.success("Logo texte enregistré.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer le logo texte.");
      }
    })();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      const image = new Image();
      image.onload = () => {
        if (image.naturalWidth < MIN_LOGO_DIMENSION || image.naturalHeight < MIN_LOGO_DIMENSION) {
          toast.error(`Image trop petite. Minimum ${MIN_LOGO_DIMENSION}x${MIN_LOGO_DIMENSION}px.`);
          return;
        }
        setPendingImageSource(src);
        setPendingImageFile(file);
      };
      image.onerror = () => toast.error("Fichier image non supporté.");
      image.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleImageSave = () => {
    if (!user?.email || !pendingImageSource || !pendingImageFile) return;
    void (async () => {
      setSavingImage(true);
      try {
        const uploadedUrl = await uploadImageToR2(pendingImageFile);
        await saveBrandingImageRequest({
          imageDataUrl: uploadedUrl,
          imageScale: pendingImageScale,
          fallbackText: branding.text,
        });
        await queryClient.invalidateQueries({ queryKey: brandingSettingsQueryKey });
        setPendingImageSource(null);
        setPendingImageFile(null);
        toast.success("Logo image enregistré.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer le logo image.");
      } finally {
        setSavingImage(false);
      }
    })();
  };

  const handleReset = () => {
    if (!user?.email) return;
    void (async () => {
      try {
        await resetBrandingSettingsRequest();
        await queryClient.invalidateQueries({ queryKey: brandingSettingsQueryKey });
        setPendingImageSource(null);
        setPendingImageFile(null);
        setPendingImageScale(100);
        toast.success("Logo réinitialisé.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Impossible de réinitialiser le logo.");
      }
    })();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configuration générale de l&apos;application.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Logo de l&apos;application</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Choisissez un texte ou une image. L&apos;image reste entière et vous pouvez réduire sa taille en pourcentage.
          </p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-lg border border-border bg-secondary flex items-center justify-center">
              {branding.mode === "image" && branding.imageDataUrl ? (
                <img
                  src={branding.imageDataUrl}
                  alt="Logo"
                  className="h-full w-full object-contain"
                  style={{ transform: `scale(${branding.imageScale / 100})` }}
                />
              ) : (
                <Type className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{branding.mode === "image" ? "Logo image" : "Logo texte"}</p>
              <p className="text-xs text-muted-foreground">
                {branding.mode === "image" ? "Image active" : branding.text}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-secondary w-full md:w-auto"
          >
            Réinitialiser
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-sm font-medium text-foreground">Utiliser un texte</p>
            <input
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              maxLength={24}
              placeholder="Nom du logo"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={handleTextSave}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Appliquer le texte
            </button>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-sm font-medium text-foreground">Utiliser une image</p>
            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm hover:bg-secondary/80">
              <ImagePlus className="h-4 w-4" />
              Sélectionner une image
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
            <p className="text-xs text-muted-foreground">Minimum {MIN_LOGO_DIMENSION}px de hauteur et largeur.</p>
            <label className="block text-xs text-muted-foreground">
              Taille du logo (%) : {pendingImageScale}%
              <input
                type="range"
                min={20}
                max={120}
                step={5}
                value={pendingImageScale}
                onChange={(e) => setPendingImageScale(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </div>
        </div>

        {pendingImageSource && (
          <div className="rounded-lg border border-border p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Prévisualisation du logo</p>
              <p className="text-xs text-muted-foreground">L&apos;image est affichée en entier, sans rognage.</p>
            </div>

            <div className="flex justify-center">
              <div className="h-24 w-full max-w-md overflow-hidden rounded-xl border border-border bg-secondary relative flex items-center justify-center">
                <img
                  src={pendingImageSource}
                  alt="Prévisualisation du logo"
                  className="h-full w-full object-contain"
                  style={{ transform: `scale(${pendingImageScale / 100})` }}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingImageSource(null);
                  setPendingImageFile(null);
                }}
                className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleImageSave}
                disabled={savingImage}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {savingImage ? "Upload..." : "Appliquer l&apos;image"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
