import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Lock, User } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { userProfileQueryKey } from "@/lib/profile-query-keys";
import { changePassword, fetchUserProfile, updateUserProfile } from "@/lib/profile-api";

const MIN_NEW_PASSWORD_LEN = 8;

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, applyLocalUserPatch } = useAuth();
  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: userProfileQueryKey,
    queryFn: fetchUserProfile,
    enabled: Boolean(user?.email),
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setPhone(profile.phone);
  }, [profile]);

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger le profil.");
    }
  }, [isError, error]);

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Le prénom et le nom sont obligatoires.");
      return;
    }
    setSavingProfile(true);
    try {
      await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      applyLocalUserPatch({ firstName: firstName.trim(), lastName: lastName.trim() });
      await queryClient.invalidateQueries({ queryKey: userProfileQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["access-profile"] });
      toast.success("Profil mis à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error("Saisissez votre mot de passe actuel.");
      return;
    }
    if (newPassword.length < MIN_NEW_PASSWORD_LEN) {
      toast.error(`Le nouveau mot de passe doit contenir au moins ${MIN_NEW_PASSWORD_LEN} caractères.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Mot de passe modifié.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de modifier le mot de passe.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mon profil</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Informations du compte et sécurité</p>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement du profil...
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Informations personnelles</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Prénom</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Nom</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
                  autoComplete="family-name"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-muted-foreground mb-1">E-mail</label>
                <input
                  value={profile?.email ?? user.email}
                  readOnly
                  disabled
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">L’adresse e-mail n’est pas modifiable ici.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-muted-foreground mb-1">Téléphone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-muted-foreground mb-1">Rôle</label>
                <input
                  value={profile?.roleLabel ?? ""}
                  readOnly
                  disabled
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void refetch()}
                className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile}
                className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
              >
                {savingProfile ? "Enregistrement..." : "Enregistrer le profil"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <Lock className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Mot de passe</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Pour votre sécurité, vous devez saisir votre mot de passe actuel avant d’en définir un nouveau.
            </p>
            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Mot de passe actuel</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground mt-1">Au moins {MIN_NEW_PASSWORD_LEN} caractères recommandés.</p>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Confirmer le nouveau mot de passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleChangePassword()}
              disabled={savingPassword}
              className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm font-medium hover:bg-secondary/80 disabled:opacity-60"
            >
              {savingPassword ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
