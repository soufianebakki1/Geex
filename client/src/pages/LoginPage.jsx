import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, FlaskConical } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLE_LABEL, canAccessPath, homeFor } from "../auth/permissions.js";
import { USE_MOCKS } from "../api/client.js";
import { Button, Field, FormError } from "../components/ui.jsx";
import Logo from "../components/Logo.jsx";

const DEMO_ACCOUNTS = [
  { email: "admin@konouz.ma", role: "admin" },
  { email: "commercial@konouz.ma", role: "commercial" },
  { email: "chef@konouz.ma", role: "chef_projet" },
  { email: "compta@konouz.ma", role: "comptable" },
];
const DEMO_PASSWORD = "konouz2026";

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const from = location.state?.from;
    const resume = from && from !== "/" && canAccessPath(user, from);
    return <Navigate to={resume ? from : homeFor(user)} replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <aside className="login__brand">
        <Logo />
        <div className="login__pitch">
          <p className="login__eyebrow">Espace collaborateurs</p>
          <h1 className="login__headline">
            Bâtir l'excellence,
            <br />
            <em>sécuriser votre avenir.</em>
          </h1>
          <p className="login__lead">Suivi des prospects, du stock et des encaissements de chaque programme, du premier contact à la remise des clés.</p>
        </div>
        <p className="login__since">Konouz Immobilier · depuis 1990</p>
      </aside>

      <main className="login__panel">
        <div className="login__form-wrap">
          <div className="login__mobile-logo">
            <Logo tone="dark" />
          </div>
          <h2 className="login__title">Connexion</h2>
          <p className="muted">Accédez à votre espace avec vos identifiants professionnels.</p>

          <form className="stack login__form" onSubmit={onSubmit} noValidate>
            <Field label="Adresse email">
              {(id) => (
                <input id={id} className="input input--lg" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="prenom.nom@konouz.ma" />
              )}
            </Field>
            <Field label="Mot de passe">
              {(id) => (
                <div className="password-field">
                  <input
                    id={id}
                    className="input input--lg"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button type="button" className="password-field__toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              )}
            </Field>
            <FormError error={error} />
            <Button variant="dark" size="lg" type="submit" loading={submitting} disabled={!email || !password}>
              Se connecter
              {!submitting && <ArrowRight size={17} />}
            </Button>
          </form>

          {USE_MOCKS && (
            <div className="login__demo">
              <p className="login__demo-title">
                <FlaskConical size={14} />
                Comptes de démonstration (développement uniquement)
              </p>
              <div className="login__demo-grid">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className="login__demo-account"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(DEMO_PASSWORD);
                      setError(null);
                    }}
                  >
                    <span className="strong">{ROLE_LABEL[account.role]}</span>
                    <span className="xsmall muted">{account.email}</span>
                  </button>
                ))}
              </div>
              <p className="xsmall faint">Mot de passe : {DEMO_PASSWORD}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
