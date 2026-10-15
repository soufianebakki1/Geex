import { useEffect, useState } from "react";
import { api } from "../api/index.js";
import { ConfirmDialog, Field } from "./ui.jsx";

export default function LeadCancelDialog({ lead, extra, onClose, onCancelled }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const open = Boolean(lead);
  useEffect(() => {
    if (!open) return;
    setReason("");
    setError(null);
  }, [open, lead?.id]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.leads.update(lead.id, { ...extra, stage: "annule", cancelReason: reason.trim() });
      onCancelled(saved);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title={`Annuler le lead ${lead?.fullName ?? ""} ?`}
      description="Le lead sera archivé à l'étape « Annulé ». Il pourra être réactivé plus tard."
      confirmLabel="Annuler le lead"
      tone="danger"
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={confirm}
    >
      <Field label="Motif d'annulation" required>
        {(id) => <textarea id={id} className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Budget insuffisant, achat ailleurs…" data-autofocus />}
      </Field>
    </ConfirmDialog>
  );
}
