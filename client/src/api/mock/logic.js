export const DAY = 86_400_000;
export const HOUR = 3_600_000;

let counter = 0;
export function uid(prefix) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`;
}

const doc = (key, label, categorie, required = true) => ({ key, label, categorie, required });
const DEPOSIT_RECEIPT = doc("acompte", "Reçu de versement de l'acompte", "paiement");

export const DOCUMENT_TEMPLATES = {
  particulier: [
    doc("cin", "CIN (recto / verso)", "identite"),
    doc("revenus", "Justificatifs de revenus (3 derniers bulletins)", "revenus"),
    doc("attestation", "Attestation de travail", "revenus"),
    doc("releves", "Relevés bancaires (3 derniers mois)", "bancaire"),
    DEPOSIT_RECEIPT,
    doc("domicile", "Justificatif de domicile", "domicile", false),
  ],
  societe: [
    doc("rc", "Registre de commerce (modèle J)", "juridique"),
    doc("statuts", "Statuts de la société", "juridique"),
    doc("pouvoirs", "PV de nomination du gérant / pouvoirs du signataire", "juridique"),
    doc("cin_gerant", "CIN du gérant ou du signataire", "identite"),
    doc("if_ice", "Attestation IF / ICE", "juridique"),
    DEPOSIT_RECEIPT,
    doc("releves", "Relevés bancaires de la société (3 derniers mois)", "bancaire", false),
  ],
  etranger: [
    doc("passeport", "Passeport en cours de validité", "identite"),
    doc("sejour", "Carte de séjour ou carte consulaire", "identite", false),
    doc("revenus", "Justificatifs de revenus", "revenus"),
    doc("releves", "Relevés bancaires (3 derniers mois)", "bancaire"),
    doc("devises", "Justificatif de transfert de fonds en devises", "bancaire"),
    DEPOSIT_RECEIPT,
  ],
  indivision: [
    doc("cin", "CIN de chaque co-acquéreur", "identite"),
    doc("revenus", "Justificatifs de revenus de chaque co-acquéreur", "revenus"),
    doc("convention", "Convention d'indivision (quotes-parts)", "juridique"),
    doc("releves", "Relevés bancaires (3 derniers mois)", "bancaire"),
    DEPOSIT_RECEIPT,
  ],
};

/** Kept for callers that only need the default (particulier) checklist. */
export const DOCUMENT_TEMPLATE = DOCUMENT_TEMPLATES.particulier;

export function newDocuments(clientType = "particulier") {
  return (DOCUMENT_TEMPLATES[clientType] ?? DOCUMENT_TEMPLATE).map((item) => ({
    ...item,
    status: "manquant",
    fileName: null,
    fileSize: null,
    uploadedAt: null,
    uploadedBy: null,
    validatedAt: null,
    validatedBy: null,
    rejectReason: null,
    history: [],
  }));
}

/**
 * en_cours: nothing received yet · incomplet: some required pieces missing or rejected ·
 * complet: every required piece received · valide: every required piece validated · rejete: dossier rejected.
 */
export function dossierState(dossier) {
  const required = dossier.documents.filter((item) => item.required);
  const received = required.filter((item) => ["en_attente", "valide"].includes(item.status)).length;
  const validated = required.filter((item) => item.status === "valide").length;
  const rejected = required.filter((item) => item.status === "rejete").length;
  const touched = dossier.documents.some((item) => item.status !== "manquant");
  let status = touched ? "incomplet" : "en_cours";
  if (received === required.length) status = validated === required.length ? "valide" : "complet";
  if (dossier.status === "rejete") status = "rejete";
  return { status, received, validated, rejected, required: required.length, total: dossier.documents.length };
}

const round100 = (value) => Math.round(value / 100) * 100;

export function buildSchedule({ reservationId, price, deposit, startAt, deliveryDate }) {
  const start = new Date(startAt).getTime();
  const delivery = Math.max(new Date(deliveryDate).getTime(), start + 300 * DAY);
  const milestones = [
    ["Signature du compromis de vente", round100(price * 0.3), start + 15 * DAY],
    ["Achèvement du gros œuvre", round100(price * 0.6), start + 120 * DAY],
    ["Achèvement des finitions", round100(price * 0.8), start + 240 * DAY],
    ["Remise des clés", price, delivery],
  ];

  const rows = [["Acompte de pré-réservation", deposit, start]];
  let covered = deposit;
  for (const [label, cumulative, due] of milestones) {
    const amount = Math.max(0, cumulative - covered);
    if (amount > 0) rows.push([label, amount, due]);
    covered = Math.max(covered, cumulative);
  }

  return rows
    .filter(([, amount]) => amount > 0)
    .map(([label, amount, due], index) => ({
      id: `${reservationId}-E${index + 1}`,
      reservationId,
      order: index + 1,
      label,
      amount,
      dueDate: new Date(due).toISOString(),
      paidAmount: 0,
      cancelled: false,
      createdAt: new Date(start).toISOString(),
    }));
}

export function installmentStatus(installment, { pendingIds = [], now = Date.now() } = {}) {
  if (installment.cancelled) return "annulee";
  if (installment.paidAmount >= installment.amount) return "payee";
  if (pendingIds.includes(installment.id)) return "en_attente";
  if (new Date(installment.dueDate).getTime() < now) return "en_retard";
  if (installment.paidAmount > 0) return "partiellement_payee";
  return "a_venir";
}

/** Single entry point for lot status changes, so every change lands in the lot history. */
export function setLotStatus(db, lot, status, { userId = null, reason = "", at = new Date().toISOString() } = {}) {
  if (!lot || lot.status === status) return;
  db.lotHistory.push({ id: uid("HL"), lotId: lot.id, from: lot.status, to: status, userId, reason, at });
  lot.status = status;
}

export function recomputeReservation(db, reservationId, { userId = null } = {}) {
  const reservation = db.reservations.find((item) => item.id === reservationId);
  if (!reservation) return;

  let available = db.payments
    .filter((payment) => payment.reservationId === reservationId && payment.status === "valide")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const installments = db.installments
    .filter((item) => item.reservationId === reservationId && !item.cancelled)
    .sort((a, b) => a.order - b.order);

  for (const installment of installments) {
    const paid = Math.min(installment.amount, available);
    installment.paidAmount = paid;
    available -= paid;
  }

  const fullyPaid = installments.length > 0 && installments.every((item) => item.paidAmount >= item.amount);
  const lot = db.lots.find((item) => item.id === reservation.lotId);
  if (fullyPaid && lot && lot.status === "reserve") {
    setLotStatus(db, lot, "vendu", { userId, reason: `Réservation ${reservation.number} intégralement payée` });
    reservation.fullyPaidAt = new Date().toISOString();
  }
}
