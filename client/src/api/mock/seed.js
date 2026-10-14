import { DAY, HOUR, buildSchedule, newDocuments, recomputeReservation } from "./logic.js";

export const DEMO_PASSWORD = "konouz2026";

function prng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slug = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "");

export function createSeed() {
  const rand = prng(1990);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const now = Date.now();
  const at = (days, hours = 0) => new Date(now + days * DAY + hours * HOUR).toISOString();
  const roundTo = (value, step) => Math.round(value / step) * step;

  const users = [
    { id: "U1", name: "Salma Bennani", email: "admin@konouz.ma", role: "admin", phone: "+212 6 61 20 45 10", active: true },
    { id: "U2", name: "Youssef El Amrani", email: "commercial@konouz.ma", role: "commercial", phone: "+212 6 62 31 87 44", active: true },
    { id: "U3", name: "Kenza Tazi", email: "k.tazi@konouz.ma", role: "commercial", phone: "+212 6 70 12 09 33", active: true },
    { id: "U4", name: "Omar Chraibi", email: "chef@konouz.ma", role: "chef_projet", phone: "+212 6 65 44 18 02", active: true },
    { id: "U5", name: "Nadia Berrada", email: "compta@konouz.ma", role: "comptable", phone: "+212 6 61 78 55 90", active: true },
  ];
  const credentials = Object.fromEntries(users.map((user) => [user.email, DEMO_PASSWORD]));
  const agents = ["U2", "U3"];

  const promoters = [
    { id: "PRM1", name: "Konouz Développement", contactName: "Rachid Bennani", email: "contact@konouz-dev.ma", phone: "+212 5 22 39 40 10", city: "Casablanca", ice: "001524879000045", address: "Boulevard d'Anfa, Casablanca" },
    { id: "PRM2", name: "Atlas Bâtisseurs", contactName: "Leila Ouazzani", email: "direction@atlas-batisseurs.ma", phone: "+212 5 37 71 22 80", city: "Rabat", ice: "002118450000071", address: "Avenue Annakhil, Hay Riad, Rabat" },
    { id: "PRM3", name: "Riad Horizon Promotion", contactName: "Mehdi Lahlou", email: "info@riadhorizon.ma", phone: "+212 5 24 43 18 66", city: "Marrakech", ice: "001902337000058", address: "Route de l'Ourika, Marrakech" },
  ];

  const managers = [
    { id: "CDP1", name: "Omar Chraibi", email: "chef@konouz.ma", phone: "+212 6 65 44 18 02", specialty: "Résidentiel haut standing" },
    { id: "CDP2", name: "Hicham Alaoui", email: "h.alaoui@konouz.ma", phone: "+212 6 68 90 12 47", specialty: "Gros œuvre & coordination chantier" },
    { id: "CDP3", name: "Meryem Fassi", email: "m.fassi@konouz.ma", phone: "+212 6 61 02 73 58", specialty: "Villas & aménagements extérieurs" },
  ];

  const projects = [
    { id: "PJ1", name: "Palm Lagoon", city: "Bouskoura", type: "Mixte", status: "en_commercialisation", promoterId: "PRM1", managerId: "CDP1", deliveryDate: at(420), description: "Villas et appartements autour d'un lagon paysager, à quelques minutes de Casablanca." },
    { id: "PJ2", name: "Les Jardins d'Anfa", city: "Casablanca", type: "Résidentiel", status: "en_construction", promoterId: "PRM1", managerId: "CDP2", deliveryDate: at(300), description: "Résidence de standing avec jardins intérieurs et commerces en rez-de-chaussée." },
    { id: "PJ3", name: "Résidence Al Andalous", city: "Rabat", type: "Résidentiel", status: "en_commercialisation", promoterId: "PRM2", managerId: "CDP3", deliveryDate: at(540), description: "Appartements familiaux à Hay Riad, proches des écoles et du tramway." },
    { id: "PJ4", name: "Domaine Oasis", city: "Marrakech", type: "Villas", status: "livre", promoterId: "PRM3", managerId: "CDP1", deliveryDate: at(-60), description: "Villas individuelles avec piscine sur la route de l'Ourika." },
  ];

  const lots = [];
  const addLot = (projectId, ref, type, floor, surface, rooms, pricePerSqm, status = "disponible") =>
    lots.push({ id: `${projectId}-${ref}`, projectId, ref, type, floor, surface, rooms, price: roundTo(surface * pricePerSqm, 10_000), status });

  for (let i = 1; i <= 8; i += 1) addLot("PJ1", `V-${String(i).padStart(2, "0")}`, "Villa", null, between(280, 420), between(4, 6), between(15_500, 18_000));
  for (let floor = 1; floor <= 3; floor += 1)
    for (let n = 1; n <= 4; n += 1) addLot("PJ1", `B1-${floor}0${n}`, "Appartement", floor, between(85, 145), between(2, 4), between(14_500, 16_500));
  for (let floor = 1; floor <= 6; floor += 1)
    for (let n = 1; n <= 4; n += 1) addLot("PJ2", `A-${floor}0${n}`, "Appartement", floor, between(72, 165), between(2, 5), between(19_000, 23_000));
  addLot("PJ2", "C-01", "Commerce", 0, between(60, 110), 1, 26_000);
  addLot("PJ2", "C-02", "Commerce", 0, between(60, 110), 1, 26_000);
  for (let floor = 1; floor <= 6; floor += 1)
    for (let n = 1; n <= 3; n += 1) addLot("PJ3", `R-${floor}0${n}`, "Appartement", floor, between(65, 130), between(2, 4), between(13_000, 15_000));
  for (let i = 1; i <= 10; i += 1) addLot("PJ4", `OA-${String(i).padStart(2, "0")}`, "Villa", null, between(300, 500), between(4, 7), between(11_000, 13_000), i <= 8 ? "vendu" : "disponible");

  const setStatus = (id, status) => {
    const lot = lots.find((item) => item.id === id);
    if (lot) lot.status = status;
  };
  ["PJ1-V-02", "PJ1-V-05", "PJ2-A-101", "PJ2-A-302", "PJ2-A-504"].forEach((id) => setStatus(id, "vendu"));
  ["PJ2-C-02", "PJ3-R-603"].forEach((id) => setStatus(id, "bloque"));

  const firstNames = ["Amine", "Sara", "Mehdi", "Imane", "Karim", "Hajar", "Othmane", "Zineb", "Reda", "Salma", "Anas", "Ghita", "Hamza", "Yasmine", "Adil", "Nisrine", "Tarik", "Loubna", "Ilyas", "Meryem", "Soufiane", "Houda", "Khalid", "Fatima Zahra", "Rachid", "Asmae", "Driss"];
  const lastNames = ["Benjelloun", "El Idrissi", "Alami", "Benkirane", "Berrada", "Sqalli", "Lahlou", "Tazi", "Chaoui", "El Fassi", "Kettani", "Bennis", "Squalli", "Mernissi", "Guessous", "Ouazzani", "Naciri", "Belhaj", "Skalli", "Amrani", "Cherkaoui", "Filali", "Hajji", "Rami", "Zniber", "Bouzidi", "Tahiri"];
  const cities = ["Casablanca", "Rabat", "Marrakech", "Tanger", "Bouskoura", "Mohammedia", "Paris", "Bruxelles"];
  const sources = ["Facebook", "Instagram", "TikTok", "LinkedIn", "Panneau publicitaire", "Kakémono", "Emailing / SMS", "Évènementiel", "Brochure / Flyer", "Réseau Konouz", "Site web", "Appel entrant"];
  const streets = ["Rue Ibn Battouta", "Boulevard Zerktouni", "Avenue Mohammed V", "Rue Al Massira", "Boulevard Ghandi", "Avenue Hassan II", "Rue des Orangers"];
  const stagePlan = [
    ...Array(5).fill("nouveau"),
    ...Array(4).fill("contacte"),
    ...Array(4).fill("visite"),
    ...Array(3).fill("negociation"),
    ...Array(5).fill("pre_reserve"),
    ...Array(4).fill("gagne"),
    ...Array(2).fill("perdu"),
  ];

  const leads = stagePlan.map((stage, index) => {
    const firstName = firstNames[index];
    const lastName = lastNames[index];
    const createdDaysAgo = stage === "nouveau" ? between(0, 6) : between(20, 240);
    const city = pick(cities);
    return {
      id: `L${String(index + 1).padStart(2, "0")}`,
      firstName,
      lastName,
      phone: `+212 6 ${between(10, 79)} ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`,
      email: `${slug(firstName)}.${slug(lastName)}@gmail.com`,
      address: `${between(1, 180)} ${pick(streets)}, ${city}`,
      city,
      source: pick(sources),
      budget: roundTo(between(1_200_000, 6_500_000), 50_000),
      projectId: pick(["PJ1", "PJ2", "PJ3"]),
      agentId: agents[index % 2],
      stage,
      createdAt: at(-createdDaysAgo, -between(0, 8)),
      lastContactAt: stage === "nouveau" ? null : at(-between(0, 9), -between(0, 8)),
      notes: "",
    };
  });

  leads[0].notes = "Souhaite un appartement lumineux avec terrasse, budget flexible si livraison avant 2028.";
  leads[9].notes = "Investisseur, intéressé par deux lots dans le même programme.";

  const contactTemplates = {
    appel: ["Premier appel : présentation du programme et des typologies disponibles.", "Relance téléphonique, le client compare avec un autre programme du quartier.", "Appel de suivi : questions sur les délais de livraison et le financement."],
    email: ["Envoi de la brochure et de la grille tarifaire.", "Envoi d'une simulation de crédit immobilier sur 20 ans."],
    whatsapp: ["Partage des plans des 3 pièces et des vues depuis les étages élevés."],
    visite: ["Visite de l'appartement témoin, retour très positif sur les finitions.", "Visite de chantier avec le conjoint."],
    rdv: ["Rendez-vous en agence pour discuter des modalités de paiement."],
  };
  const contactTypeLabel = { appel: "Appel", email: "Email", whatsapp: "WhatsApp", visite: "Visite", rdv: "Rendez-vous" };
  const stageLabel = { nouveau: "Nouveau", contacte: "Contacté", visite: "Visite", negociation: "Négociation", pre_reserve: "Pré-réservé", gagne: "Gagné", perdu: "Perdu" };
  const stageOrder = Object.keys(stageLabel);

  const contacts = [];
  const activities = [];
  const addActivity = (activity) => activities.push({ id: `ACT${activities.length + 1}`, ...activity });

  leads.forEach((lead) => {
    addActivity({ type: "lead_created", leadId: lead.id, userId: lead.agentId, at: lead.createdAt, message: `Lead créé (source : ${lead.source})` });
    const reached = Math.min(stageOrder.indexOf(lead.stage), 3);
    const created = new Date(lead.createdAt).getTime();
    const span = Math.max(now - created, DAY);
    for (let step = 1; step <= reached; step += 1) {
      addActivity({ type: "stage", leadId: lead.id, userId: lead.agentId, at: new Date(created + (span * step) / 5).toISOString(), message: `Étape : ${stageLabel[stageOrder[step]]}` });
    }
    if (lead.stage === "nouveau") return;
    const count = between(1, 4);
    for (let i = 0; i < count; i += 1) {
      const type = i === count - 1 && lead.stage !== "contacte" ? pick(["visite", "rdv", "appel"]) : pick(["appel", "email", "whatsapp", "appel"]);
      const date = new Date(created + (span * (i + 1)) / (count + 1)).toISOString();
      contacts.push({ id: `CT${contacts.length + 1}`, leadId: lead.id, type, date, summary: pick(contactTemplates[type]), userId: lead.agentId });
      addActivity({ type: "contact", leadId: lead.id, userId: lead.agentId, at: date, message: `${contactTypeLabel[type]} enregistré` });
    }
    if (lead.stage === "perdu") {
      addActivity({ type: "stage", leadId: lead.id, userId: lead.agentId, at: at(-between(3, 15)), message: "Étape : Perdu — budget insuffisant" });
    }
  });
  contacts.forEach((contact) => {
    const lead = leads.find((item) => item.id === contact.leadId);
    if (!lead.lastContactAt || contact.date > lead.lastContactAt) lead.lastContactAt = contact.date;
  });

  const takeLot = (lead) => {
    const lot = lots.find((item) => item.projectId === lead.projectId && item.status === "disponible" && item.type !== "Commerce");
    lead.budget = roundTo(lot.price * 1.05, 50_000);
    return lot;
  };

  const preReservations = [];
  const dossiers = [];
  const reservations = [];
  const installments = [];
  const payments = [];
  let reservationSeq = 0;
  let bulletinSeq = 0;

  const addPreReservation = (lead, lot, { createdAt, validityDays, status, deposit }) => {
    const pre = {
      id: `PR${String(preReservations.length + 1).padStart(3, "0")}`,
      leadId: lead.id,
      lotId: lot.id,
      deposit,
      depositMethod: "Virement",
      validityHours: validityDays * 24,
      createdAt,
      expiresAt: new Date(new Date(createdAt).getTime() + validityDays * DAY).toISOString(),
      status,
      createdBy: lead.agentId,
      note: "",
    };
    preReservations.push(pre);
    addActivity({ type: "pre_reservation", leadId: lead.id, userId: lead.agentId, at: createdAt, message: `Pré-réservation du lot ${lot.ref} (acompte ${deposit.toLocaleString("fr-FR")} MAD)` });
    return pre;
  };

  const addDossier = (lead, lot, pre, receivedKeys, validatedKeys = []) => {
    const createdAt = new Date(new Date(pre.createdAt).getTime() + DAY).toISOString();
    const documents = newDocuments().map((doc) => {
      if (!receivedKeys.includes(doc.key)) return doc;
      const uploadedAt = new Date(new Date(createdAt).getTime() + between(2, 40) * HOUR).toISOString();
      const validated = validatedKeys.includes(doc.key);
      return {
        ...doc,
        status: validated ? "valide" : "recu",
        fileName: `${doc.key}_${slug(lead.lastName)}.pdf`,
        fileSize: between(180, 2400) * 1024,
        uploadedAt,
        uploadedBy: lead.agentId,
        validatedAt: validated ? uploadedAt : null,
        validatedBy: validated ? "U5" : null,
      };
    });
    const dossier = { id: `DS${String(dossiers.length + 1).padStart(3, "0")}`, preReservationId: pre.id, leadId: lead.id, lotId: lot.id, createdAt, createdBy: lead.agentId, documents };
    dossiers.push(dossier);
    addActivity({ type: "dossier", leadId: lead.id, userId: lead.agentId, at: createdAt, message: "Dossier de réservation ouvert" });
    return dossier;
  };

  const allKeys = newDocuments().map((doc) => doc.key);
  const requiredKeys = newDocuments().filter((doc) => doc.required).map((doc) => doc.key);

  const preLeads = leads.filter((lead) => lead.stage === "pre_reserve");
  const wonLeads = leads.filter((lead) => lead.stage === "gagne");
  const lostLeads = leads.filter((lead) => lead.stage === "perdu");

  const activePlans = [
    { createdAt: at(-1, -19), validityDays: 2 },
    { createdAt: at(-1), validityDays: 3 },
    { createdAt: at(-1, -3), validityDays: 7 },
  ];
  activePlans.forEach((plan, index) => {
    const lead = preLeads[index];
    const lot = takeLot(lead);
    lot.status = "pre_reserve";
    addPreReservation(lead, lot, { ...plan, status: "active", deposit: roundTo(lot.price * 0.05, 5_000) });
  });

  {
    const lead = preLeads[3];
    const lot = takeLot(lead);
    lot.status = "pre_reserve";
    const pre = addPreReservation(lead, lot, { createdAt: at(-4), validityDays: 7, status: "convertie", deposit: roundTo(lot.price * 0.05, 5_000) });
    addDossier(lead, lot, pre, ["cin", "revenus", "acompte"], ["cin"]);
  }

  const createReservation = (lead, lot, dossier, pre, { createdAt, confirmedAt, bulletin }) => {
    reservationSeq += 1;
    const reservation = {
      id: `RS${String(reservationSeq).padStart(3, "0")}`,
      number: `RES-2026-${String(reservationSeq).padStart(3, "0")}`,
      dossierId: dossier.id,
      leadId: lead.id,
      lotId: lot.id,
      projectId: lot.projectId,
      price: lot.price,
      deposit: pre.deposit,
      status: confirmedAt ? "confirmee" : "en_attente",
      createdAt,
      createdBy: lead.agentId,
      confirmedAt: confirmedAt ?? null,
      confirmedBy: confirmedAt ? lead.agentId : null,
      bulletinNumber: null,
      bulletinGeneratedAt: null,
      blocked: false,
      blockedReason: null,
    };
    reservations.push(reservation);
    addActivity({ type: "reservation", leadId: lead.id, userId: lead.agentId, at: createdAt, message: `Réservation ${reservation.number} créée` });

    if (confirmedAt) {
      lot.status = "reserve";
      const project = projects.find((item) => item.id === lot.projectId);
      installments.push(...buildSchedule({ reservationId: reservation.id, price: lot.price, deposit: pre.deposit, startAt: confirmedAt, deliveryDate: project.deliveryDate }));
      payments.push({
        id: `PAY${String(payments.length + 1).padStart(3, "0")}`,
        reservationId: reservation.id,
        amount: pre.deposit,
        method: "Virement",
        reference: `ACOMPTE-${pre.id}`,
        date: pre.createdAt,
        status: "valide",
        note: "Acompte versé à la pré-réservation",
        createdBy: lead.agentId,
        createdAt: pre.createdAt,
        validatedBy: "U5",
        validatedAt: confirmedAt,
        comment: "",
      });
      addActivity({ type: "reservation", leadId: lead.id, userId: lead.agentId, at: confirmedAt, message: `Réservation ${reservation.number} confirmée` });
      if (bulletin) {
        bulletinSeq += 1;
        reservation.bulletinNumber = `BR-2026-${String(bulletinSeq).padStart(4, "0")}`;
        reservation.bulletinGeneratedAt = confirmedAt;
      }
    }
    return reservation;
  };

  {
    const lead = preLeads[4];
    const lot = takeLot(lead);
    lot.status = "pre_reserve";
    const pre = addPreReservation(lead, lot, { createdAt: at(-9), validityDays: 7, status: "convertie", deposit: roundTo(lot.price * 0.05, 5_000) });
    const dossier = addDossier(lead, lot, pre, requiredKeys, ["cin", "revenus"]);
    createReservation(lead, lot, dossier, pre, { createdAt: at(-1, -5) });
  }

  const wonPlans = [
    { confirmedDaysAgo: 200, bulletin: true },
    { confirmedDaysAgo: 95, bulletin: true },
    { confirmedDaysAgo: 35, bulletin: true },
    { confirmedDaysAgo: 8, bulletin: false },
  ];
  const won = wonLeads.map((lead, index) => {
    const plan = wonPlans[index];
    const lot = takeLot(lead);
    const confirmedAt = at(-plan.confirmedDaysAgo);
    const pre = addPreReservation(lead, lot, { createdAt: at(-plan.confirmedDaysAgo - 12), validityDays: 7, status: "convertie", deposit: roundTo(lot.price * 0.05, 5_000) });
    const dossier = addDossier(lead, lot, pre, allKeys, allKeys);
    const reservation = createReservation(lead, lot, dossier, pre, { createdAt: at(-plan.confirmedDaysAgo - 2), confirmedAt, bulletin: plan.bulletin });
    return { lead, lot, reservation };
  });

  const scheduleOf = (reservationId) => installments.filter((item) => item.reservationId === reservationId).sort((a, b) => a.order - b.order);
  const addPayment = (reservation, amount, { date, status, method = "Virement", reference, createdBy = "U2", comment = "", note = "" }) => {
    payments.push({
      id: `PAY${String(payments.length + 1).padStart(3, "0")}`,
      reservationId: reservation.id,
      amount,
      method,
      reference,
      date,
      status,
      note,
      createdBy,
      createdAt: date,
      validatedBy: status === "en_attente" ? null : "U5",
      validatedAt: status === "en_attente" ? null : date,
      comment,
    });
  };

  {
    const { reservation } = won[0];
    const [, compromis] = scheduleOf(reservation.id);
    addPayment(reservation, compromis.amount, { date: at(-186), status: "valide", reference: "VIR-AWB-118274" });
  }
  {
    const { reservation } = won[1];
    const [, compromis, grosOeuvre] = scheduleOf(reservation.id);
    addPayment(reservation, compromis.amount, { date: at(-82), status: "valide", reference: "VIR-BMCE-552901" });
    addPayment(reservation, 150_000, { date: at(-3), status: "en_attente", method: "Chèque", reference: "CHQ 0048213", createdBy: "U3", note: `Avance sur « ${grosOeuvre.label} »` });
    addPayment(reservation, 80_000, { date: at(-12), status: "rejete", method: "Chèque", reference: "CHQ 0047990", createdBy: "U3", comment: "Chèque non signé, à représenter." });
  }
  {
    const { reservation } = won[2];
    const [, compromis] = scheduleOf(reservation.id);
    addPayment(reservation, roundTo(compromis.amount * 0.6, 1_000), { date: at(-18), status: "valide", reference: "VIR-CIH-330187" });
    addPayment(reservation, compromis.amount - roundTo(compromis.amount * 0.6, 1_000), { date: at(-1), status: "en_attente", method: "Versement bancaire", reference: "VRS-ATW-77120" });
  }

  reservations.forEach((reservation) => recomputeReservation({ reservations, payments, installments, lots }, reservation.id));

  lostLeads.forEach((lead, index) => {
    if (index > 0) return;
    const lot = lots.find((item) => item.projectId === lead.projectId && item.status === "disponible");
    addPreReservation(lead, lot, { createdAt: at(-40), validityDays: 7, status: "expiree", deposit: roundTo(lot.price * 0.05, 5_000) });
  });

  const notifications = [];
  const notify = (notification) => notifications.push({ id: `N${notifications.length + 1}`, readBy: [], ...notification });
  const leadName = (lead) => `${lead.firstName} ${lead.lastName}`;
  const firstActive = preReservations.find((pre) => pre.status === "active");
  const activeLead = leads.find((lead) => lead.id === firstActive.leadId);
  const activeLot = lots.find((lot) => lot.id === firstActive.lotId);

  notify({ type: "warning", title: "Pré-réservation bientôt expirée", message: `La pré-réservation de ${leadName(activeLead)} sur le lot ${activeLot.ref} expire dans moins de 6 heures.`, link: "/pre-reservations", roles: ["admin", "commercial"], at: at(0, -1) });
  notify({ type: "info", title: "Paiement à valider", message: `Versement bancaire reçu pour ${won[2].reservation.number} (${leadName(won[2].lead)}).`, link: "/paiements", roles: ["admin", "comptable"], at: at(-1) });
  notify({ type: "info", title: "Paiement à valider", message: `Chèque de 150 000 MAD reçu pour ${won[1].reservation.number} (${leadName(won[1].lead)}).`, link: "/paiements", roles: ["admin", "comptable"], at: at(-3) });
  notify({ type: "danger", title: "Échéance en retard", message: `« Achèvement du gros œuvre » de ${won[0].reservation.number} n'est pas réglée.`, link: `/echeancier?reservationId=${won[0].reservation.id}`, roles: ["admin", "comptable", "commercial"], at: at(-2) });
  notify({ type: "success", title: "Réservation confirmée", message: `${won[3].reservation.number} — ${leadName(won[3].lead)}, lot ${won[3].lot.ref}. Bulletin à générer.`, link: `/reservations/${won[3].reservation.id}`, roles: null, at: at(-8) });
  notify({ type: "info", title: "Dossier complet", message: `Le dossier de ${leadName(preLeads[4])} est complet et attend la confirmation de réservation.`, link: "/reservations", roles: ["admin", "commercial"], at: at(-1, -5) });
  notify({ type: "info", title: "Nouveau lead", message: `${leadName(leads[0])} a demandé à être rappelé depuis le site web.`, link: `/leads/${leads[0].id}`, roles: ["admin", "commercial"], at: leads[0].createdAt, readBy: users.map((user) => user.id) });
  notify({ type: "info", title: "Lot bloqué", message: "Le lot R-603 (Résidence Al Andalous) est bloqué pour réserve technique.", link: "/lots?projectId=PJ3", roles: ["admin", "chef_projet"], at: at(-6), readBy: users.map((user) => user.id) });

  return {
    users,
    credentials,
    sessions: {},
    promoters,
    managers,
    projects,
    lots,
    leads,
    contacts,
    activities,
    preReservations,
    dossiers,
    reservations,
    installments,
    payments,
    notifications,
    counters: { reservation: reservationSeq, bulletin: bulletinSeq },
  };
}
