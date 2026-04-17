import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    const normalizedPhone = phone.replace(/\s+/g, "");
    if (!/^\+?[0-9]{8,15}$/.test(normalizedPhone)) {
      toast.error("Le numero de telephone est invalide.");
      return;
    }

    setSubmitting(true);
    const result = await register({ lastName, firstName, email, phone: normalizedPhone, password });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message || "Compte cree. Bienvenue sur AutoParc.");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -bottom-40 -left-16 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -top-20 right-4 h-72 w-72 rounded-full bg-info/20 blur-3xl" />
      </div>

      <div className="relative container mx-auto min-h-screen flex items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl md:grid-cols-2">
          <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-info/20 to-primary/20 border-r border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Car className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">AutoParc</span>
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-bold leading-tight">Creez votre espace de gestion AutoParc.</h1>
              <p className="text-muted-foreground">
                Inscrivez-vous pour centraliser vos vehicules, suivre les operations et garder une vue claire.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Configuration rapide et interface professionnelle
            </div>
          </div>

          <div className="p-6 md:p-10">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="px-0">
                <CardTitle className="text-2xl">Inscription</CardTitle>
                <CardDescription>Créez votre compte pour commencer.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nom</Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Ex: Dupont"
                        autoComplete="family-name"
                        disabled={submitting}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="firstName">Prenom</Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="Ex: Jean"
                        autoComplete="given-name"
                        disabled={submitting}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="exemple@autoparc.com"
                      autoComplete="email"
                      disabled={submitting}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+223 00 00 00 00"
                      autoComplete="tel"
                      disabled={submitting}
                      required
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="password">Mot de passe</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Min. 6 caracteres"
                        autoComplete="new-password"
                        disabled={submitting}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmation</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Retapez le mot de passe"
                        autoComplete="new-password"
                        disabled={submitting}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creation..." : "Creer mon compte"}
                  </Button>
                </form>

                <p className="mt-6 text-sm text-muted-foreground">
                  Vous avez deja un compte ?{" "}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Se connecter
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
