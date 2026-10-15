import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Briefcase, Calculator, HardHat, Landmark, ShieldCheck } from "lucide-react";
import { SignInCard } from "@/components/ui/sign-in-card-2";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLE_LABEL, canAccessPath, homeFor } from "../auth/permissions.js";
import { USE_MOCKS } from "../api/client.js";
import { errorMessage } from "../api/errors.js";
import Logo from "../components/Logo.jsx";
import LoginBackdrop from "../components/LoginBackdrop.jsx";

const DEMO_ACCOUNTS = [
  { email: "admin@konouz.ma", role: "admin", icon: ShieldCheck },
  { email: "direction@konouz.ma", role: "direction", icon: Landmark },
  { email: "commercial@konouz.ma", role: "commercial", icon: Briefcase },
  { email: "chef@konouz.ma", role: "chef_projet", icon: HardHat },
  { email: "compta@konouz.ma", role: "comptable", icon: Calculator },
];
const DEMO_PASSWORD = "konouz2026";

function DemoAccounts({ selected, onSelect }) {
  return (
    <section className="login-roles" aria-labelledby="login-roles-title">
      <div className="login-roles__head">
        <p id="login-roles-title" className="login-roles__title">
          Comptes de démonstration
        </p>
        <p className="login-roles__hint">
          Mot de passe : <span className="num">{DEMO_PASSWORD}</span>
        </p>
      </div>
      <div className="login-roles__grid">
        {DEMO_ACCOUNTS.map(({ email, role, icon: Icon }) => (
          <button key={email} type="button" className="login-role" aria-pressed={selected === email} onClick={() => onSelect(email)}>
            <span className="login-role__icon">
              <Icon size={16} />
            </span>
            <span className="login-role__text">
              <span className="login-role__name">{ROLE_LABEL[role]}</span>
              <span className="login-role__email">
                {email.split("@")[0]}@<wbr />
                {email.split("@")[1]}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const from = location.state?.from;
    const resume = from && from !== "/" && canAccessPath(user, from);
    return <Navigate to={resume ? from : homeFor(user)} replace />;
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  function selectDemo(account) {
    setEmail(account);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="login">
      <div className="login__layout">
        <header className="login__bar">
          <Logo size={76} />
          <p className="login__since">Konouz Immobilier · depuis 1990</p>
        </header>

        <main className="login__main">
          <SignInCard
            withBackground={false}
            className="pointer-events-auto max-w-[520px]"
            title="Connexion"
            subtitle="Accédez à votre espace avec vos identifiants professionnels."
            emailPlaceholder="prenom.nom@konouz.ma"
            passwordPlaceholder="Mot de passe"
            email={email}
            password={password}
            onEmailChange={(value) => {
              setEmail(value);
              setError(null);
            }}
            onPasswordChange={(value) => {
              setPassword(value);
              setError(null);
            }}
            onSubmit={submit}
            loading={submitting}
            error={error ? errorMessage(error) : null}
            footer={USE_MOCKS ? <DemoAccounts selected={email} onSelect={selectDemo} /> : null}
          />
        </main>

        <footer className="login__footer">
          <p className="login__tagline">
            Bâtir l'excellence, <em>sécuriser votre avenir.</em>
          </p>
        </footer>
      </div>

      <LoginBackdrop caption="Nos programmes à Agadir, en images" />
    </div>
  );
}
