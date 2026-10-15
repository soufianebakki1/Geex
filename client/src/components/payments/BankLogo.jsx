import { useState } from "react";
import { Globe2, Wallet } from "lucide-react";
import { BANK } from "../../utils/status.js";

export function BankLogo({ bank, size = 28 }) {
  const meta = BANK[bank];
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, "--bank-color": meta?.color ?? "var(--c-taupe-400)" };

  if (meta?.logo && !broken) {
    return (
      <span className="bank-logo" style={style}>
        <img src={meta.logo} alt="" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span className="bank-logo bank-logo--mono" style={{ ...style, fontSize: size * (meta?.short?.length > 3 ? 0.26 : 0.32) }}>
      {meta?.short ?? "?"}
    </span>
  );
}

export const bankName = (payment) => (payment.bank === "autre" ? payment.bankOther || "Autre banque" : BANK[payment.bank]?.label);

/** Bank logo for national funds, a globe for international ones, a wallet when no bank applies. */
export function SourceMark({ payment, size = 26 }) {
  if (payment.origin !== "international" && payment.bank) return <BankLogo bank={payment.bank} size={size} />;
  const Icon = payment.origin === "international" ? Globe2 : Wallet;
  return (
    <span className={`pay-source__mark ${payment.origin === "international" ? "" : "pay-source__mark--muted"}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.52)} />
    </span>
  );
}

export function PaymentSource({ payment, size = 26 }) {
  const international = payment.origin === "international";
  const name = international ? payment.foreignBank || "Fonds de l'étranger" : payment.bank ? bankName(payment) : payment.method === "especes" ? "Remise en espèces" : "Banque non précisée";
  const meta = international ? `${payment.country} · ${payment.foreignAmount?.toLocaleString("fr-FR")} ${payment.currency}` : "National";

  return (
    <span className="pay-source">
      <SourceMark payment={payment} size={size} />
      <span className="pay-source__text">
        <span className="pay-source__name">{name}</span>
        <span className={`pay-source__meta ${international ? "pay-source__meta--intl" : ""}`}>{meta}</span>
      </span>
    </span>
  );
}
