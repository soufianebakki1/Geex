import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, Ban, Plus, Wallet } from "lucide-react";
import { api } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import { Button, Card, EmptyState, ErrorState, Field, FormError, LoadingBlock, Modal, PageHeader, SearchInput, Segmented, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatMAD, toDateInput } from "../utils/format.js";
import { PAYMENT_METHODS, PAYMENT_STATUS } from "../utils/status.js";

function PaymentForm({ open, initialReservationId, onClose, onSaved }) {
  const reservations = useAsync(() => (open ? api.reservations.list({ status: "confirmee" }) : Promise.resolve(null)), [open]);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({ reservationId: initialReservationId ?? "", amount: "", method: "Virement", reference: "", date: toDateInput(), note: "" });
  }, [open, initialReservationId]);

  const selected = reservations.data?.find((item) => item.id === form.reservationId);
  const payable = selected ? Math.max(selected.totals.remaining - selected.totals.pending, 0) : null;
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.payments.create({ ...form, amount: Number(form.amount), reference: form.reference.trim(), note: form.note.trim() });
      onSaved(created);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      title="Enregistrer un paiement"
      subtitle="Le paiement sera soumis à la validation de la comptabilité."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="payment-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="payment-form" className="stack" onSubmit={submit}>
        <Field label="Réservation" required>
          {(id) => (
            <select id={id} className="select" value={form.reservationId ?? ""} onChange={set("reservationId")} required disabled={!reservations.data}>
              <option value="">{reservations.data ? "Sélectionner une réservation…" : "Chargement…"}</option>
              {(reservations.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} — {item.lead?.name} · lot {item.lot?.ref}
                </option>
              ))}
            </select>
          )}
        </Field>
        {selected && (
          <div className="pre-form__lot">
            <div>
              <p className="xsmall muted">Reste à payer</p>
              <p className="strong num">{formatMAD(selected.totals.remaining)}</p>
            </div>
            <div>
              <p className="xsmall muted">Déjà en attente</p>
              <p className="strong num">{formatMAD(selected.totals.pending)}</p>
            </div>
          </div>
        )}
        <div className="form-grid">
          <Field label="Montant" required hint={payable != null ? `Maximum saisissable : ${formatMAD(payable)}` : undefined}>
            {(id) => (
              <div className="input-affix">
                <input id={id} className="input num" type="number" min="1" max={payable ?? undefined} step="any" value={form.amount ?? ""} onChange={set("amount")} required />
                <span className="input-affix__suffix">MAD</span>
              </div>
            )}
          </Field>
          <Field label="Date de réception" required>
            {(id) => <input id={id} className="input" type="date" value={form.date ?? ""} onChange={set("date")} required />}
          </Field>
          <Field label="Mode de paiement" required>
            {(id) => (
              <select id={id} className="select" value={form.method ?? ""} onChange={set("method")}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Référence" required hint="N° de chèque, de virement ou de bordereau">
            {(id) => <input id={id} className="input" value={form.reference ?? ""} onChange={set("reference")} required />}
          </Field>
          <Field label="Note" className="span-2">
            {(id) => <textarea id={id} className="textarea" rows={2} value={form.note ?? ""} onChange={set("note")} />}
          </Field>
        </div>
        <FormError error={error ?? reservations.error} />
      </form>
    </Modal>
  );
}

function DecisionModal({ decision, onClose, onDone }) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const payment = decision?.payment;
  const reject = decision?.kind === "reject";

  useEffect(() => {
    setComment("");
    setError(null);
  }, [decision]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = reject ? await api.payments.reject(payment.id, comment.trim()) : await api.payments.validate(payment.id, comment.trim());
      onDone(updated);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(decision)}
      onClose={onClose}
      busy={saving}
      size="sm"
      title={reject ? "Rejeter le paiement" : "Valider le paiement"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant={reject ? "danger" : "success"} type="submit" form="decision-form" loading={saving} disabled={reject && !comment.trim()}>
            {reject ? "Rejeter" : "Valider l'encaissement"}
          </Button>
        </>
      }
    >
      {payment && (
        <form id="decision-form" className="stack" onSubmit={submit}>
          <dl className="dl">
            <dt>Client</dt>
            <dd>{payment.lead?.name}</dd>
            <dt>Réservation</dt>
            <dd>
              {payment.reservation?.number} · lot {payment.lot?.ref}
            </dd>
            <dt>Montant</dt>
            <dd className="num strong">{formatMAD(payment.amount)}</dd>
            <dt>Mode</dt>
            <dd>
              {payment.method} · {payment.reference}
            </dd>
            <dt>Reçu le</dt>
            <dd>{formatDate(payment.date)}</dd>
          </dl>
          <Field label={reject ? "Motif du rejet" : "Commentaire (facultatif)"} required={reject}>
            {(id) => <textarea id={id} className="textarea" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} required={reject} placeholder={reject ? "Ex. : chèque non signé, montant erroné…" : ""} />}
          </Field>
          <FormError error={error} />
        </form>
      )}
    </Modal>
  );
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const payments = useAsync(() => api.payments.list(), []);
  const canValidate = can(user, "payments.validate");
  const [tab, setTab] = useState(canValidate ? "en_attente" : "all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(Boolean(params.get("reservationId")) && can(user, "payments.create"));
  const [decision, setDecision] = useState(null);

  const counts = useMemo(() => {
    const items = payments.data ?? [];
    const count = (status) => items.filter((item) => item.status === status).length;
    return { all: items.length, en_attente: count("en_attente"), valide: count("valide"), rejete: count("rejete") };
  }, [payments.data]);

  const summary = useMemo(() => {
    const items = payments.data ?? [];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const pending = items.filter((item) => item.status === "en_attente");
    const validatedMonth = items.filter((item) => item.status === "valide" && item.validatedAt >= monthStart);
    return {
      pendingAmount: pending.reduce((total, item) => total + item.amount, 0),
      validatedMonth: validatedMonth.reduce((total, item) => total + item.amount, 0),
      validatedMonthCount: validatedMonth.length,
    };
  }, [payments.data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payments.data ?? [])
      .filter((item) => tab === "all" || item.status === tab)
      .filter((item) => !q || `${item.lead?.name} ${item.reference} ${item.reservation?.number} ${item.lot?.ref}`.toLowerCase().includes(q));
  }, [payments.data, tab, query]);

  const replace = (updated) => payments.setData((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Paiements"
        description={canValidate ? "Contrôlez et validez les encaissements saisis par les équipes commerciales." : "Saisie des encaissements clients, validés ensuite par la comptabilité."}
        actions={
          can(user, "payments.create") && (
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
              Enregistrer un paiement
            </Button>
          )
        }
      />

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className={`stat ${counts.en_attente ? "stat--warning" : ""}`}>
          <p className="stat__label">À valider</p>
          <p className="stat__value">{formatMAD(summary.pendingAmount)}</p>
          <p className="stat__hint">{counts.en_attente} paiement(s) en attente</p>
        </div>
        <div className="stat">
          <p className="stat__label">Validés ce mois-ci</p>
          <p className="stat__value">{formatMAD(summary.validatedMonth)}</p>
          <p className="stat__hint">{summary.validatedMonthCount} opération(s)</p>
        </div>
        <div className="stat">
          <p className="stat__label">Rejetés</p>
          <p className="stat__value">{counts.rejete}</p>
          <p className="stat__hint">À régulariser avec le client</p>
        </div>
      </div>

      <div className="toolbar">
        <Segmented
          label="Statut"
          value={tab}
          onChange={setTab}
          items={[
            { value: "en_attente", label: "À valider", count: counts.en_attente },
            { value: "valide", label: "Validés", count: counts.valide },
            { value: "rejete", label: "Rejetés", count: counts.rejete },
            { value: "all", label: "Tous", count: counts.all },
          ]}
        />
        <span className="toolbar__spacer" />
        <SearchInput value={query} onChange={setQuery} placeholder="Client, référence, réservation…" />
      </div>

      <Card flush>
        {payments.loading && !payments.data ? (
          <div className="card__body">
            <LoadingBlock />
          </div>
        ) : payments.error && !payments.data ? (
          <ErrorState error={payments.error} onRetry={payments.reload} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Wallet} title={tab === "en_attente" ? "Aucun paiement à valider" : "Aucun paiement"} description={tab === "en_attente" ? "Tous les encaissements ont été traités." : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Réservation</th>
                  <th className="align-right">Montant</th>
                  <th>Mode · Référence</th>
                  <th>Statut</th>
                  {canValidate && tab !== "valide" && tab !== "rejete" && <th className="cell-actions">Validation</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="nowrap">{formatDate(item.date)}</td>
                    <td>
                      <div className="cell-primary">{item.lead?.name}</div>
                      <div className="cell-secondary">saisi par {item.createdByUser?.name ?? "—"}</div>
                    </td>
                    <td>
                      {can(user, "reservations") ? (
                        <Link to={`/reservations/${item.reservation?.id}`} className="link num">
                          {item.reservation?.number}
                        </Link>
                      ) : (
                        <span className="num">{item.reservation?.number}</span>
                      )}
                      <div className="cell-secondary">
                        Lot {item.lot?.ref} · {item.lot?.project?.name}
                      </div>
                    </td>
                    <td className="align-right num strong nowrap">{formatMAD(item.amount)}</td>
                    <td>
                      <div>{item.method}</div>
                      <div className="cell-secondary">{item.reference}</div>
                    </td>
                    <td>
                      <StatusBadge map={PAYMENT_STATUS} value={item.status} />
                      {item.status !== "en_attente" && (
                        <div className="cell-secondary" title={item.comment || undefined}>
                          {item.validatedByUser?.name} · {formatDateTime(item.validatedAt)}
                          {item.comment ? ` — ${item.comment}` : ""}
                        </div>
                      )}
                    </td>
                    {canValidate && tab !== "valide" && tab !== "rejete" && (
                      <td className="cell-actions">
                        {item.status === "en_attente" ? (
                          <div className="btn-group">
                            <Button size="sm" variant="success" icon={BadgeCheck} onClick={() => setDecision({ kind: "validate", payment: item })}>
                              Valider
                            </Button>
                            <Button size="sm" variant="danger-ghost" icon={Ban} onClick={() => setDecision({ kind: "reject", payment: item })}>
                              Rejeter
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PaymentForm
        open={formOpen}
        initialReservationId={params.get("reservationId")}
        onClose={() => {
          setFormOpen(false);
          if (params.get("reservationId")) setParams({}, { replace: true });
        }}
        onSaved={(created) => {
          payments.setData((items) => [created, ...(items ?? [])]);
          setFormOpen(false);
          if (params.get("reservationId")) setParams({}, { replace: true });
          toast.success("Paiement enregistré, en attente de validation.");
        }}
      />

      <DecisionModal
        decision={decision}
        onClose={() => setDecision(null)}
        onDone={(updated) => {
          replace(updated);
          toast.success(updated.status === "valide" ? "Encaissement validé, échéancier mis à jour." : "Paiement rejeté.");
          setDecision(null);
        }}
      />
    </>
  );
}
