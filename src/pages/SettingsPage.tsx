import { ChangeEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ImagePlus, Loader2, Palette, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { uploadImageToR2 } from "@/lib/cloudflare-upload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [resettingBranding, setResettingBranding] = useState(false);

  const { data: brandingData = DEFAULT_BRANDING } = useQuery({
    queryKey: [...brandingSettingsQueryKey, user?.email ?? "anonymous"],
    queryFn: getBrandingSettingsRequest,
    enabled: Boolean(user?.email),
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
        if (user?.email) {
          queryClient.setQueryData([...brandingSettingsQueryKey, user.email], {
            mode: "text",
            text,
            imageDataUrl: null,
            imageScale: branding.imageScale || 100,
          } as BrandingConfig);
        }
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
        if (user?.email) {
          queryClient.setQueryData([...brandingSettingsQueryKey, user.email], {
            mode: "image",
            text: branding.text || DEFAULT_BRANDING.text,
            imageDataUrl: uploadedUrl,
            imageScale: pendingImageScale,
          } as BrandingConfig);
        }
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
    if (!user?.email || resettingBranding) return;
    setResettingBranding(true);
    setBranding(DEFAULT_BRANDING);
    setTextDraft(DEFAULT_BRANDING.text);
    setPendingImageSource(null);
    setPendingImageFile(null);
    setPendingImageScale(100);
    if (user?.email) {
      queryClient.setQueryData([...brandingSettingsQueryKey, user.email], DEFAULT_BRANDING);
    }
    void (async () => {
      try {
        await resetBrandingSettingsRequest();
        await queryClient.invalidateQueries({ queryKey: brandingSettingsQueryKey });
        toast.success("Logo réinitialisé.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Impossible de réinitialiser le logo.");
      } finally {
        setResettingBranding(false);
      }
    })();
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 px-6 py-7 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Paramètres</h1>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Personnalisez l&apos;apparence de votre espace et consultez les informations liées à votre abonnement.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1.5 sm:inline-flex sm:w-auto sm:min-w-[320px]">
          <TabsTrigger
            value="branding"
            className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Palette className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="font-medium">Marque et logo</span>
          </TabsTrigger>
          <TabsTrigger
            value="subscription"
            className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <CreditCard className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="font-medium">Abonnement</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-6 focus-visible:outline-none">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 space-y-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Marque affichée dans l&apos;application</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                  Nom ou image affiché dans la barre latérale et l&apos;en-tête mobile. L&apos;image reste entière ; vous
                  pouvez ajuster son échelle en pourcentage.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl bg-muted/40 border border-border/60 px-4 py-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-border bg-background flex items-center justify-center shadow-inner">
                  {branding.mode === "image" && branding.imageDataUrl ? (
                    <img
                      src={branding.imageDataUrl}
                      alt="Logo"
                      className="h-full w-full object-contain"
                      style={{ transform: `scale(${branding.imageScale / 100})` }}
                    />
                  ) : (
                    <Type className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {branding.mode === "image" ? "Logo image" : "Logo texte"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {branding.mode === "image" ? "Image active dans la navigation" : branding.text}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                disabled={resettingBranding}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted transition-colors w-full md:w-auto disabled:opacity-60"
              >
                {resettingBranding && <Loader2 className="h-4 w-4 animate-spin" />}
                {resettingBranding ? "Réinitialisation..." : "Réinitialiser (AutoParc)"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Type className="h-4 w-4 text-primary" />
                  Texte du logo
                </p>
                <input
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  maxLength={24}
                  placeholder="Nom affiché"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                />
                <button
                  type="button"
                  onClick={handleTextSave}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-95 transition-opacity"
                >
                  Enregistrer le texte
                </button>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-primary" />
                  Image du logo
                </p>
                <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                  <ImagePlus className="h-4 w-4" />
                  Choisir une image
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
                <p className="text-xs text-muted-foreground">Minimum {MIN_LOGO_DIMENSION}×{MIN_LOGO_DIMENSION} px.</p>
                <label className="block text-xs text-muted-foreground">
                  Échelle d&apos;affichage : {pendingImageScale}%
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={5}
                    value={pendingImageScale}
                    onChange={(e) => setPendingImageScale(Number(e.target.value))}
                    className="mt-2 w-full accent-primary"
                  />
                </label>
              </div>
            </div>

            {pendingImageSource && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Prévisualisation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Aperçu sans rognage, comme dans la navigation.</p>
                </div>
                <div className="flex justify-center">
                  <div className="h-28 w-full max-w-md overflow-hidden rounded-xl border border-border bg-background flex items-center justify-center">
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
                    className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleImageSave}
                    disabled={savingImage}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {savingImage ? "Envoi..." : "Enregistrer l'image"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="subscription" className="mt-6 focus-visible:outline-none">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Abonnement</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Suivez ici votre formule, votre statut et les options de facturation lorsqu&apos;elles seront disponibles.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/30 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Formule actuelle</p>
                <p className="mt-2 text-xl font-semibold text-foreground">Standard</p>
                <p className="mt-1 text-sm text-muted-foreground">Accès complet aux modules de votre espace.</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Statut</p>
                <p className="mt-2 text-xl font-semibold text-foreground">Actif</p>
                <p className="mt-1 text-sm text-muted-foreground">Aucune action requise pour le moment.</p>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/70 mb-3" aria-hidden />
              <p className="text-sm font-medium text-foreground">Évolution à venir</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Le changement de formule, l&apos;historique de facturation et le portail client seront proposés dans une
                prochaine version. Contactez le support si vous avez besoin d&apos;une modification de contrat.
              </p>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
