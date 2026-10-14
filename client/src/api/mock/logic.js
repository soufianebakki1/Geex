export const DAY = 86_400_000;
export const HOUR = 3_600_000;

let counter = 0;
export function uid(prefix) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`;
}

export const DOCUMENT_TEMPLATE = [
  { key: "cin", label: "CIN (recto / verso)", required: true },
  { key: "revenus", label: "Justificatifs de revenus (3 derniers bulletins)", required: true },
  { key: "attestation", label: "Attestation de travail ou registre de commerce", required: true },
  { key: "releves", label: "Relevés bancaires (3 derniers mois)", required: true },
  { key: "acompte", label: "Reçu de versement de l'acompte", required: true },
  { key: "domicile", label: "Justificatif de domicile", required: false },
];

export function newDocuments() {
  return DOCUMENT_TEMPLATE.map((doc) => ({
    ...doc,
    status: "manquant",
    fileName: null,
    fileSize: null,
    uploadedAt: null,
    uploadedBy: null,
    validatedAt: null,
    validatedBy: null,
  }));
}

export function dossierState(dossier) {
  const required = dossier.documents.filter((doc) => doc.required);
  const received = required.filter((doc) => doc.status !== "manquant").length;
  const validated = required.filter((doc) => doc.status === "valide").length;
  let status = "incomplet";
  if (received === required.length) status = validated === required.length ? "valide" : "complet";
  if (dossier.status === "annule") status = "annule";
  return { status, received, validated, required: required.length, total: dossier.documents.length };
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
    }));
}

export function installmentStatus(installment, now = Date.now()) {
  if (installment.paidAmount >= installment.amount) return "paye";
  if (new Date(installment.dueDate).getTime() < now) return "en_retard";
  if (installment.paidAmount > 0) return "partiel";
  return "a_venir";
}

export function recomputeReservation(db, reservationId) {
  const reservation = db.reservations.find((item) => item.id === reservationId);
  if (!reservation) return;

  let available = db.payments
    .filter((payment) => payment.reservationId === reservationId && payment.status === "valide")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const installments = db.installments
    .filter((item) => item.reservationId === reservationId)
    .sort((a, b) => a.order - b.order);

  for (const installment of installments) {
    const paid = Math.min(installment.amount, available);
    installment.paidAmount = paid;
    available -= paid;
  }

  const fullyPaid = installments.length > 0 && installments.every((item) => item.paidAmount >= item.amount);
  const lot = db.lots.find((item) => item.id === reservation.lotId);
  if (fullyPaid && lot && lot.status === "reserve") {
    lot.status = "vendu";
    reservation.fullyPaidAt = new Date().toISOString();
  }
}
