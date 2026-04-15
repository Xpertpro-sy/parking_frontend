import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = login({ email, password });
    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success("Bienvenue sur AutoParc.");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-36 -left-20 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-20 -right-20 h-96 w-96 rounded-full bg-info/15 blur-3xl" />
      </div>

      <div className="relative container mx-auto min-h-screen flex items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl md:grid-cols-2">
          <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/20 to-info/20 border-r border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Car className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">AutoParc</span>
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-bold leading-tight">Gerez votre parking en toute simplicite.</h1>
              <p className="text-muted-foreground">
                Connectez-vous pour acceder au tableau de bord, suivre les vehicules et optimiser vos operations.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" />
              Acces securise a votre espace de gestion
            </div>
          </div>

          <div className="p-6 md:p-10">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="px-0">
                <CardTitle className="text-2xl">Connexion</CardTitle>
                <CardDescription>Renseignez vos identifiants pour acceder a votre espace.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="exemple@autoparc.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Se connecter
                  </Button>
                </form>

                <p className="mt-6 text-sm text-muted-foreground">
                  Vous n'avez pas de compte ?{" "}
                  <Link to="/register" className="text-primary hover:underline font-medium">
                    Creer un compte
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
