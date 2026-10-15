import { DAY, HOUR, buildSchedule, newDocuments, recomputeReservation, setLotStatus } from "./logic.js";
import { LEAD_STAGE, LOT_TYPE } from "../../utils/status.js";

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

const pad = (value, size) => String(value).padStart(size, "0");

export function createSeed() {
  const rand = prng(1990);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const now = Date.now();
  const at = (days, hours = 0) => new Date(now + days * DAY + hours * HOUR).toISOString();
  const shift = (iso, days, hours = 0) => new Date(new Date(iso).getTime() + days * DAY + hours * HOUR).toISOString();
  const roundTo = (value, step) => Math.round(value / step) * step;

  /* ---------------------------------------------------------------- */
  /* Users (project managers are users with the chef_projet role)     */
  /* ---------------------------------------------------------------- */

  const person = (id, firstName, lastName, email, role, phone, createdDaysAgo) => ({
    id,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email,
    role,
    phone,
    active: true,
    createdAt: at(-createdDaysAgo),
  });
  const users = [
    person("U1", "Salma", "Bennani", "admin@konouz.ma", "admin", "+212 6 61 20 45 10", 900),
    person("U2", "Youssef", "El Amrani", "commercial@konouz.ma", "commercial", "+212 6 62 31 87 44", 600),
    person("U3", "Kenza", "Tazi", "k.tazi@konouz.ma", "commercial", "+212 6 70 12 09 33", 420),
    person("U4", "Omar", "Chraibi", "chef@konouz.ma", "chef_projet", "+212 6 65 44 18 02", 800),
    person("U5", "Nadia", "Berrada", "compta@konouz.ma", "comptable", "+212 6 61 78 55 90", 700),
    person("U6", "Hicham", "Alaoui", "h.alaoui@konouz.ma", "chef_projet", "+212 6 68 90 12 47", 500),
    person("U7", "Meryem", "Fassi", "m.fassi@konouz.ma", "chef_projet", "+212 6 61 02 73 58", 350),
    person("U8", "Karim", "Lazrak", "direction@konouz.ma", "direction", "+212 6 61 00 19 90", 1000),
  ];
  const credentials = Object.fromEntries(users.map((user) => [user.email, DEMO_PASSWORD]));
  const agents = ["U2", "U3"];

  /* ---------------------------------------------------------------- */
  /* Promoters, projects, tranches, buildings, lots                   */
  /* ---------------------------------------------------------------- */

  const promoters = [
    { id: "PRM1", group: "Groupe Konouz", company: "Konouz Développement SARL", rc: "245871 — Casablanca", ifNumber: "15204871", ice: "001524879000045", headOffice: "Boulevard d'Anfa, Casablanca", createdAt: at(-900) },
    { id: "PRM2", group: "Groupe Atlas", company: "Atlas Bâtisseurs SA", rc: "98214 — Rabat", ifNumber: "40187255", ice: "002118450000071", headOffice: "Avenue Annakhil, Hay Riad, Rabat", createdAt: at(-700) },
    { id: "PRM3", group: "Horizon Holding", company: "Riad Horizon Promotion SARL", rc: "77412 — Marrakech", ifNumber: "25871430", ice: "001902337000058", headOffice: "Route de l'Ourika, Marrakech", createdAt: at(-950) },
  ];

  const projects = [
    { id: "PJ1", name: "Palm Lagoon", type: "residence", promoterId: "PRM1", managerId: "U4", address: "Route de la Ville Verte, Bouskoura", consistance: ["f2", "f3", "f4", "villa"], tfMere: "TF 12874/C", deliveryDate: at(420), active: true, createdAt: at(-400) },
    { id: "PJ2", name: "Les Jardins d'Anfa", type: "residence", promoterId: "PRM1", managerId: "U6", address: "Boulevard d'Anfa, Casablanca", consistance: ["f2", "f3", "f4", "duplex", "commerce"], tfMere: "TF 45120/63", deliveryDate: at(300), active: true, createdAt: at(-500) },
    { id: "PJ3", name: "Résidence Al Andalous", type: "residence", promoterId: "PRM2", managerId: "U7", address: "Avenue Annakhil, Hay Riad, Rabat", consistance: ["f2", "f3", "f4"], tfMere: "TF 8841/R", deliveryDate: at(540), active: true, createdAt: at(-300) },
    { id: "PJ4", name: "Domaine Oasis", type: "lotissement", promoterId: "PRM3", managerId: "U4", address: "Route de l'Ourika, km 9, Marrakech", consistance: ["villa", "lot"], tfMere: "TF 30552/M", deliveryDate: at(-60), active: true, createdAt: at(-900) },
    { id: "PJ5", name: "Galerie Al Massira", type: "galerie_commerce", promoterId: "PRM2", managerId: "U6", address: "Avenue Hassan II, Agadir", consistance: ["commerce"], tfMere: "TF 19907/A", deliveryDate: at(240), active: true, createdAt: at(-150) },
  ];
  const projectById = Object.fromEntries(projects.map((project) => [project.id, project]));

  const tranches = [];
  const buildings = [];
  const addTranche = (projectId, name, description = "") => {
    const tranche = { id: `TR${tranches.length + 1}`, projectId, name, description };
    tranches.push(tranche);
    return tranche;
  };
  const addBuilding = (tranche, name, floors) => {
    const building = { id: `IM${buildings.length + 1}`, trancheId: tranche.id, name, floors };
    buildings.push(building);
    return building;
  };

  const lots = [];
  const addLot = ({ projectId, tranche, building = null, ref, type, floor = null, surface, pricePerSqm, parking = false }) =>
    lots.push({
      id: `${projectId}-${ref}`,
      projectId,
      trancheId: tranche.id,
      buildingId: building?.id ?? null,
      ref,
      type,
      surface,
      price: roundTo(surface * pricePerSqm, 10_000),
      floor,
      parking,
      status: "disponible",
      createdAt: projectById[projectId].createdAt,
    });
  const flatType = (surface) => (surface < 85 ? "f2" : surface < 115 ? "f3" : "f4");

  {
    const villas = addTranche("PJ1", "Tranche 1 — Villas", "Villas individuelles autour du lagon.");
    for (let i = 1; i <= 8; i += 1) addLot({ projectId: "PJ1", tranche: villas, ref: `V-${pad(i, 2)}`, type: "villa", surface: between(280, 420), pricePerSqm: between(15_500, 18_000), parking: true });
    const flats = addTranche("PJ1", "Tranche 2 — Appartements", "Petit collectif face au lagon.");
    const b1 = addBuilding(flats, "Immeuble B1", 3);
    for (let floor = 1; floor <= 3; floor += 1)
      for (let n = 1; n <= 4; n += 1) {
        const surface = between(70, 145);
        addLot({ projectId: "PJ1", tranche: flats, building: b1, ref: `B1-${floor}0${n}`, type: flatType(surface), floor, surface, pricePerSqm: between(14_500, 16_500), parking: rand() < 0.6 });
      }
  }
  {
    const tranche = addTranche("PJ2", "Tranche unique");
    const a = addBuilding(tranche, "Immeuble A", 6);
    for (let floor = 1; floor <= 5; floor += 1)
      for (let n = 1; n <= 4; n += 1) {
        const surface = between(72, 150);
        addLot({ projectId: "PJ2", tranche, building: a, ref: `A-${floor}0${n}`, type: flatType(surface), floor, surface, pricePerSqm: between(19_000, 23_000), parking: rand() < 0.7 });
      }
    for (let n = 1; n <= 2; n += 1) addLot({ projectId: "PJ2", tranche, building: a, ref: `A-60${n}`, type: "duplex", floor: 6, surface: between(165, 210), pricePerSqm: between(22_000, 24_000), parking: true });
    for (let n = 1; n <= 2; n += 1) addLot({ projectId: "PJ2", tranche, building: a, ref: `C-0${n}`, type: "commerce", floor: 0, surface: between(60, 110), pricePerSqm: 26_000 });
  }
  {
    const tranche = addTranche("PJ3", "Tranche 1");
    const r = addBuilding(tranche, "Immeuble R", 6);
    for (let floor = 1; floor <= 6; floor += 1)
      for (let n = 1; n <= 3; n += 1) {
        const surface = between(65, 130);
        addLot({ projectId: "PJ3", tranche, building: r, ref: `R-${floor}0${n}`, type: flatType(surface), floor, surface, pricePerSqm: between(13_000, 15_000), parking: rand() < 0.5 });
      }
  }
  {
    const tranche = addTranche("PJ4", "Tranche unique", "Villas livrées et terrains viabilisés.");
    for (let i = 1; i <= 10; i += 1) addLot({ projectId: "PJ4", tranche, ref: `OA-${pad(i, 2)}`, type: "villa", surface: between(300, 500), pricePerSqm: between(11_000, 13_000), parking: true });
    for (let i = 1; i <= 6; i += 1) addLot({ projectId: "PJ4", tranche, ref: `TR-${pad(i, 2)}`, type: "lot", surface: between(250, 450), pricePerSqm: between(3_200, 4_200) });
  }
  {
    const tranche = addTranche("PJ5", "Tranche 1");
    const galerie = addBuilding(tranche, "Galerie", 2);
    for (let n = 1; n <= 6; n += 1) addLot({ projectId: "PJ5", tranche, building: galerie, ref: `G-00${n}`, type: "commerce", floor: 0, surface: between(40, 120), pricePerSqm: between(24_000, 30_000) });
    for (let n = 1; n <= 4; n += 1) addLot({ projectId: "PJ5", tranche, building: galerie, ref: `G-10${n}`, type: "commerce", floor: 1, surface: between(50, 140), pricePerSqm: between(18_000, 22_000) });
  }

  const lotHistory = [];
  const db = { lots, lotHistory };
  const lotById = (id) => lots.find((item) => item.id === id);
  const setStatus = (id, status, reason, when, userId = "U4") => setLotStatus(db, lotById(id), status, { userId, reason, at: when });
  for (let i = 1; i <= 8; i += 1) setStatus(`PJ4-OA-${pad(i, 2)}`, "vendu", "Vente conclue avant la mise en service du CRM", at(-between(200, 600)), "U1");
  ["PJ4-TR-02", "PJ4-TR-05", "PJ1-V-02", "PJ1-V-05", "PJ2-A-101", "PJ2-A-302", "PJ2-A-504"].forEach((id) =>
    setStatus(id, "vendu", "Vente conclue avant la mise en service du CRM", at(-between(120, 400)), "U1"),
  );
  setStatus("PJ2-C-02", "bloque", "Réservé au syndic de la résidence", at(-20));
  setStatus("PJ3-R-603", "bloque", "Réserve technique : reprise d'étanchéité", at(-6), "U7");

  /* ---------------------------------------------------------------- */
  /* Marketing sources (client sheet "SOURCES MARKETING")             */
  /* ---------------------------------------------------------------- */

  const sources = [
    ["Réseaux sociaux", "Facebook"],
    ["Réseaux sociaux", "Instagram"],
    ["Réseaux sociaux", "TikTok"],
    ["Réseaux sociaux", "LinkedIn"],
    ["Panneaux", "Panneaux"],
    ["Kakémonos", "Kakémonos"],
    ["Emailing", "Emailing"],
    ["SMS", "SMS"],
    ["Événementiel", "Événementiel"],
    ["Brochure / Flyer", "Brochure / Flyer"],
    ["Réseau Konouz", "Réseau Konouz"],
  ].map(([category, name], index) => ({ id: `SRC${index + 1}`, category, name }));
  const sourceName = (id) => sources.find((source) => source.id === id)?.name ?? "—";

  /* ---------------------------------------------------------------- */
  /* Leads, follow-ups and interactions                               */
  /* ---------------------------------------------------------------- */

  const firstNames = ["Amine", "Sara", "Mehdi", "Imane", "Karim", "Hajar", "Othmane", "Zineb", "Reda", "Salma", "Anas", "Ghita", "Hamza", "Yasmine", "Adil", "Nisrine", "Tarik", "Loubna", "Ilyas", "Meryem", "Soufiane", "Houda", "Khalid", "Fatima Zahra", "Rachid", "Asmae", "Driss"];
  const lastNames = ["Benjelloun", "El Idrissi", "Alami", "Benkirane", "Berrada", "Sqalli", "Lahlou", "Tazi", "Chaoui", "El Fassi", "Kettani", "Bennis", "Squalli", "Mernissi", "Guessous", "Ouazzani", "Naciri", "Belhaj", "Skalli", "Amrani", "Cherkaoui", "Filali", "Hajji", "Rami", "Zniber", "Bouzidi", "Tahiri"];
  const cities = ["Casablanca", "Rabat", "Marrakech", "Tanger", "Bouskoura", "Mohammedia", "Agadir", "Paris", "Bruxelles"];
  const streets = ["Rue Ibn Battouta", "Boulevard Zerktouni", "Avenue Mohammed V", "Rue Al Massira", "Boulevard Ghandi", "Avenue Hassan II", "Rue des Orangers"];
  const delays = ["Immédiat", "1 mois", "3 mois", "6 mois", "Plus de 6 mois"];
  const motivations = ["Résidence principale", "Résidence secondaire", "Investissement locatif"];
  const desiredCityOf = { PJ1: "Bouskoura", PJ2: "Casablanca", PJ3: "Rabat" };
  const stagePlan = [
    ...Array(2).fill("nouveau"),
    ...Array(3).fill("affecte"),
    ...Array(3).fill("contacte"),
    ...Array(3).fill("qualifie"),
    ...Array(2).fill("en_visite"),
    ...Array(3).fill("en_negociation"),
    ...Array(5).fill("pre_reserve"),
    ...Array(4).fill("signe"),
    ...Array(2).fill("annule"),
  ];
  const societeLeads = new Set([9, 21]);

  const leads = stagePlan.map((stage, index) => {
    const firstName = firstNames[index];
    const lastName = lastNames[index];
    const createdDaysAgo = ["nouveau", "affecte"].includes(stage) ? between(0, 6) : stage === "signe" ? between(260, 320) : stage === "pre_reserve" ? between(45, 90) : between(20, 240);
    const city = index === 23 ? "Paris" : pick(cities.slice(0, 7));
    const projectId = pick(["PJ1", "PJ2", "PJ3"]);
    const budgetMin = roundTo(between(1_200_000, 5_000_000), 50_000);
    const surfaceMin = between(70, 140);
    const createdAt = at(-createdDaysAgo, -between(0, 8));
    const agentId = stage === "nouveau" ? null : agents[index % 2];
    return {
      id: `L${pad(index + 1, 2)}`,
      agentId,
      sourceId: pick(sources).id,
      projectId,
      fullName: `${firstName} ${lastName}`,
      phone: `+212 6 ${between(10, 79)} ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`,
      email: index % 5 === 4 ? "" : `${slug(firstName)}.${slug(lastName)}@gmail.com`,
      address: `${between(1, 180)} ${pick(streets)}, ${city}`,
      stage,
      clientType: societeLeads.has(index) ? "societe" : "particulier",
      propertyType: pick(["F2", "F3", "F4", "Villa"]),
      budgetMin,
      budgetMax: budgetMin + roundTo(between(300_000, 1_500_000), 50_000),
      desiredCity: desiredCityOf[projectId],
      surfaceMin,
      surfaceMax: surfaceMin + between(20, 80),
      financing: pick(["comptant", "credit", "credit", "aide_etat"]),
      purchaseDelay: pick(delays),
      motivation: societeLeads.has(index) ? "Local professionnel" : pick(motivations),
      assignedAt: agentId ? shift(createdAt, 0, between(1, 6)) : null,
      lastActivityAt: null,
      cancelReason: null,
      followUp1Date: null,
      followUp1Outcome: null,
      followUp2Date: null,
      followUp2Outcome: null,
      remark: "",
      createdAt,
    };
  });

  leads[2].remark = "Souhaite un appartement lumineux avec terrasse, budget flexible si livraison avant 2028.";
  leads[9].remark = "Investisseur : achat au nom de la société Fassi Invest SARL, intéressé par deux lots dans le même programme.";
  leads[21].remark = "Acquisition au nom de la société Filali Conseil SARL (bureaux).";

  const contacts = [];
  const activities = [];
  const addActivity = (activity) => activities.push({ id: `ACT${activities.length + 1}`, ...activity });
  const notesBy = {
    telephone: ["Premier appel : présentation du programme et des typologies disponibles.", "Relance téléphonique, le client compare avec un autre programme du quartier.", "Appel de suivi : questions sur les délais de livraison et le financement."],
    email: ["Envoi de la brochure et de la grille tarifaire.", "Envoi d'une simulation de crédit immobilier sur 20 ans."],
    whatsapp: ["Partage des plans et des vues depuis les étages élevés."],
    visite: ["Visite de l'appartement témoin, retour très positif sur les finitions.", "Visite de chantier avec le conjoint."],
    autre: ["Rencontre au salon de l'immobilier, échange sur les modalités de paiement."],
  };
  const progression = ["affecte", "contacte", "qualifie", "en_visite", "en_negociation"];

  leads.forEach((lead) => {
    addActivity({ type: "lead_created", leadId: lead.id, userId: lead.agentId ?? "U1", at: lead.createdAt, message: `Lead créé (source : ${sourceName(lead.sourceId)})` });
    if (!lead.agentId) return;
    const created = new Date(lead.createdAt).getTime();
    const span = Math.max(now - created, DAY);
    const reachedIndex = lead.stage === "annule" ? 2 : Math.min(progression.indexOf(lead.stage) === -1 ? progression.length - 1 : progression.indexOf(lead.stage), progression.length - 1);
    for (let step = 0; step <= reachedIndex; step += 1) {
      const from = step === 0 ? "nouveau" : progression[step - 1];
      addActivity({ type: "stage", leadId: lead.id, userId: step === 0 ? "U1" : lead.agentId, at: new Date(created + (span * (step + 0.2)) / 6).toISOString(), message: `Étape : ${LEAD_STAGE[from].label} → ${LEAD_STAGE[progression[step]].label}` });
    }
    if (lead.stage === "affecte") {
      lead.followUp1Date = at(between(0, 3), between(1, 6));
      return;
    }

    const count = between(1, 4);
    for (let i = 0; i < count; i += 1) {
      const last = i === count - 1;
      const advanced = !["contacte", "qualifie", "annule"].includes(lead.stage);
      const channel = last && advanced ? "visite" : pick(["telephone", "email", "whatsapp", "telephone", "autre"]);
      const result = channel === "visite" ? pick(["contact_etabli", "rdv_fixe"]) : last && lead.stage === "annule" ? "non_interesse" : pick(["contact_etabli", "contact_etabli", "sans_reponse", "rappel_demande", "rdv_fixe"]);
      const date = new Date(created + (span * (i + 1)) / (count + 1)).toISOString();
      contacts.push({
        id: `CT${contacts.length + 1}`,
        leadId: lead.id,
        userId: lead.agentId,
        channel,
        at: date,
        durationMinutes: channel === "visite" ? between(30, 90) : channel === "telephone" ? between(3, 20) : null,
        result,
        notes: pick(notesBy[channel]),
        createdAt: date,
      });
      addActivity({ type: "contact", leadId: lead.id, userId: lead.agentId, at: date, message: `Interaction enregistrée (${channel === "telephone" ? "téléphone" : channel})` });
      if (!lead.lastActivityAt || date > lead.lastActivityAt) lead.lastActivityAt = date;
    }

    const past = (days) => at(-days, -between(1, 6));
    switch (lead.stage) {
      case "contacte":
        Object.assign(lead, { followUp1Date: past(between(5, 12)), followUp1Outcome: "en_reflexion", followUp2Date: at(between(1, 5), 2) });
        break;
      case "qualifie":
        Object.assign(lead, { followUp1Date: past(between(6, 14)), followUp1Outcome: "en_reflexion", followUp2Date: at(0, between(1, 4)) });
        break;
      case "en_visite":
        Object.assign(lead, { followUp1Date: past(between(8, 20)), followUp1Outcome: "rendez_vous", followUp2Date: at(between(1, 4), 3) });
        break;
      case "en_negociation":
        Object.assign(lead, { followUp1Date: past(between(15, 30)), followUp1Outcome: "rendez_vous", followUp2Date: past(between(2, 6)), followUp2Outcome: "en_reflexion" });
        break;
      case "pre_reserve":
        Object.assign(lead, { followUp1Date: past(between(20, 40)), followUp1Outcome: "rendez_vous", followUp2Date: past(between(2, 10)), followUp2Outcome: "reservation" });
        break;
      case "signe":
        Object.assign(lead, { followUp1Date: past(between(220, 260)), followUp1Outcome: "rendez_vous", followUp2Date: past(between(210, 215)), followUp2Outcome: "concretisation" });
        break;
      case "annule":
        Object.assign(lead, { followUp1Date: past(between(25, 40)), followUp1Outcome: "en_reflexion", followUp2Date: past(between(5, 15)), followUp2Outcome: "annulation" });
        break;
      default:
        break;
    }
  });

  const lostReasons = ["Budget insuffisant après simulation bancaire", "A acheté dans un programme concurrent"];
  leads
    .filter((lead) => lead.stage === "annule")
    .forEach((lead, index) => {
      lead.cancelReason = lostReasons[index];
      addActivity({ type: "stage", leadId: lead.id, userId: lead.agentId, at: lead.followUp2Date, message: `Étape : Qualifié → Annulé — motif : ${lead.cancelReason}` });
    });

  /* ---------------------------------------------------------------- */
  /* Pre-reservations, dossiers, reservations, schedules, payments    */
  /* ---------------------------------------------------------------- */

  const takeLot = (lead) => {
    const lot = lots.find((item) => item.projectId === lead.projectId && item.status === "disponible" && !["commerce", "lot"].includes(item.type));
    lead.propertyType = LOT_TYPE[lot.type].label;
    lead.budgetMin = roundTo(lot.price * 0.9, 50_000);
    lead.budgetMax = roundTo(lot.price * 1.1, 50_000);
    lead.surfaceMin = Math.max(40, Math.floor(lot.surface - 15));
    lead.surfaceMax = Math.ceil(lot.surface + 20);
    return lot;
  };
  const setLeadStage = (lead, stage, when, message) => {
    addActivity({ type: "stage", leadId: lead.id, userId: lead.agentId, at: when, message: message ?? `Étape : ${LEAD_STAGE[lead.stage].label} → ${LEAD_STAGE[stage].label}` });
    lead.stage = stage;
  };

  const preReservations = [];
  const dossiers = [];
  const reservations = [];
  const installments = [];
  const payments = [];
  const counters = { reservation: 0, bulletin: 0, preReservation: 0 };
  const preReasons = ["Client décidé, attente du virement de l'acompte", "Blocage le temps de réunir les pièces du dossier", "Accord de principe, financement bancaire en cours"];

  const addPreReservation = (lead, lot, { createdAt, validityDays, status, deposit, extendedAt = null }) => {
    counters.preReservation += 1;
    const pre = {
      id: `PR${pad(preReservations.length + 1, 3)}`,
      number: `PR-2026-${pad(counters.preReservation, 4)}`,
      leadId: lead.id,
      lotId: lot.id,
      agentId: lead.agentId,
      deposit,
      depositMethod: "virement",
      validityHours: validityDays * 24,
      createdAt,
      expiresAt: shift(createdAt, validityDays),
      reason: pick(preReasons),
      comments: "",
      status,
      extendedAt,
      cancelReason: null,
      createdBy: lead.agentId,
    };
    preReservations.push(pre);
    if (status !== "expiree") setLeadStage(lead, "pre_reserve", createdAt);
    setLotStatus(db, lot, "pre_reserve", { userId: lead.agentId, reason: `Pré-réservation ${pre.number}`, at: createdAt });
    if (status === "expiree") setLotStatus(db, lot, "disponible", { userId: null, reason: `Pré-réservation ${pre.number} expirée`, at: pre.expiresAt });
    addActivity({ type: "pre_reservation", leadId: lead.id, userId: lead.agentId, at: createdAt, message: `Pré-réservation ${pre.number} du lot ${lot.ref} (acompte ${deposit.toLocaleString("fr-FR")} MAD)` });
    return pre;
  };

  const dossierClientType = (lead) => (lead.clientType === "societe" ? "societe" : /Paris|Bruxelles/.test(lead.address) ? "etranger" : "particulier");
  const addDossier = (lead, lot, pre, { received, validated, rejected = [] }) => {
    const createdAt = shift(pre.createdAt, 1);
    const clientType = dossierClientType(lead);
    const template = newDocuments(clientType);
    const keysOf = (spec) => (spec === "all" ? template.map((item) => item.key) : spec === "required" ? template.filter((item) => item.required).map((item) => item.key) : template.filter((item) => item.required).slice(0, spec).map((item) => item.key));
    const receivedKeys = keysOf(received);
    const validatedKeys = keysOf(validated);
    let lastValidation = null;
    const documents = template.map((item) => {
      if (!receivedKeys.includes(item.key) && !rejected.includes(item.key)) return item;
      const uploadedAt = shift(createdAt, 0, between(2, 40));
      const fileName = `${item.key}_${slug(lead.fullName.split(" ")[1] ?? lead.fullName)}.pdf`;
      const history = [{ at: uploadedAt, userId: lead.agentId, action: "upload", detail: fileName }];
      if (rejected.includes(item.key)) {
        const rejectedAt = shift(uploadedAt, 0, 5);
        history.push({ at: rejectedAt, userId: "U5", action: "reject", detail: "Document illisible, merci de renvoyer un scan couleur." });
        return { ...item, status: "rejete", fileName, fileSize: between(180, 2400) * 1024, uploadedAt, uploadedBy: lead.agentId, validatedAt: null, validatedBy: null, rejectReason: "Document illisible, merci de renvoyer un scan couleur.", history };
      }
      const isValid = validatedKeys.includes(item.key);
      if (isValid) {
        history.push({ at: shift(uploadedAt, 0, 3), userId: "U5", action: "validate", detail: "" });
        if (!lastValidation || shift(uploadedAt, 0, 3) > lastValidation) lastValidation = shift(uploadedAt, 0, 3);
      }
      return { ...item, status: isValid ? "valide" : "en_attente", fileName, fileSize: between(180, 2400) * 1024, uploadedAt, uploadedBy: lead.agentId, validatedAt: isValid ? shift(uploadedAt, 0, 3) : null, validatedBy: isValid ? "U5" : null, history };
    });
    const allRequiredValid = documents.filter((item) => item.required).every((item) => item.status === "valide");
    const dossier = { id: `DS${pad(dossiers.length + 1, 3)}`, preReservationId: pre.id, leadId: lead.id, lotId: lot.id, agentId: lead.agentId, clientType, status: null, createdAt, createdBy: lead.agentId, validatedAt: allRequiredValid ? lastValidation : null, documents };
    dossiers.push(dossier);
    addActivity({ type: "dossier", leadId: lead.id, userId: lead.agentId, at: createdAt, message: "Dossier de réservation ouvert" });
    return dossier;
  };

  const PAYMENT_TERMS = "Acompte à la pré-réservation, 30 % à la signature du compromis, appels de fonds à l'avancement des travaux et solde à la remise des clés.";
  const createReservation = (lead, lot, dossier, pre, { createdAt, signedAt = null, bulletin = false, discount = 0, discountReason = "", approved = false }) => {
    counters.reservation += 1;
    const reservation = {
      id: `RS${pad(counters.reservation, 3)}`,
      number: `RSV-2026-${pad(counters.reservation, 4)}`,
      dossierId: dossier.id,
      leadId: lead.id,
      lotId: lot.id,
      projectId: lot.projectId,
      agentId: lead.agentId,
      listPrice: lot.price,
      discount,
      discountReason,
      approvedBy: discount && approved ? "U8" : null,
      approvedAt: discount && approved ? shift(createdAt, 0, 4) : null,
      price: lot.price - discount,
      deposit: pre.deposit,
      paymentTerms: PAYMENT_TERMS,
      status: signedAt ? "active" : "en_attente",
      createdAt,
      createdBy: lead.agentId,
      signedAt,
      signedBy: signedAt ? lead.agentId : null,
      bulletinNumber: null,
      bulletinGeneratedAt: null,
      blocked: false,
      blockedReason: null,
      endReason: null,
      endedAt: null,
      endedBy: null,
    };
    reservations.push(reservation);
    addActivity({ type: "reservation", leadId: lead.id, userId: lead.agentId, at: createdAt, message: `Réservation ${reservation.number} créée` });
    setLeadStage(lead, "reserve", createdAt);

    if (signedAt) {
      setLotStatus(db, lot, "reserve", { userId: lead.agentId, reason: `Réservation ${reservation.number} signée`, at: signedAt });
      const project = projectById[lot.projectId];
      const schedule = buildSchedule({ reservationId: reservation.id, price: reservation.price, deposit: pre.deposit, startAt: signedAt, deliveryDate: project.deliveryDate });
      installments.push(...schedule);
      payments.push({
        id: `PAY${pad(payments.length + 1, 3)}`,
        reservationId: reservation.id,
        installmentId: schedule[0].id,
        amount: pre.deposit,
        method: "virement",
        reference: `ACOMPTE-${pre.number}`,
        proofFileName: `recu_acompte_${pre.number}.pdf`,
        date: pre.createdAt,
        status: "valide",
        note: "Acompte versé à la pré-réservation",
        createdBy: lead.agentId,
        createdAt: pre.createdAt,
        validatedBy: "U5",
        validatedAt: signedAt,
        comment: "",
        rejectReason: null,
      });
      addActivity({ type: "reservation", leadId: lead.id, userId: lead.agentId, at: signedAt, message: `Réservation ${reservation.number} signée — échéancier généré` });
      setLeadStage(lead, "signe", signedAt);
      if (bulletin) {
        counters.bulletin += 1;
        reservation.bulletinNumber = `BR-2026-${pad(counters.bulletin, 4)}`;
        reservation.bulletinGeneratedAt = signedAt;
      }
    }
    return reservation;
  };

  const preLeads = leads.filter((lead) => lead.stage === "pre_reserve");
  const wonLeads = leads.filter((lead) => lead.stage === "signe");
  const lostLeads = leads.filter((lead) => lead.stage === "annule");
  [...preLeads, ...wonLeads].forEach((lead) => {
    lead.stage = "en_negociation";
  });

  const activePlans = [
    { createdAt: at(-1, -19), validityDays: 2 },
    { createdAt: at(-1), validityDays: 3 },
    { createdAt: at(-5, -3), validityDays: 7, extendedAt: at(-1, -2) },
  ];
  activePlans.forEach((plan, index) => {
    const lead = preLeads[index];
    const lot = takeLot(lead);
    addPreReservation(lead, lot, { ...plan, status: "active", deposit: roundTo(lot.price * 0.05, 5_000) });
  });
  preReservations[2].comments = "Prolongation accordée par la direction : le client attend l'accord de sa banque.";

  {
    const lead = preLeads[3];
    const lot = takeLot(lead);
    const pre = addPreReservation(lead, lot, { createdAt: at(-4), validityDays: 7, status: "convertie", deposit: roundTo(lot.price * 0.05, 5_000) });
    const rejectedKey = newDocuments(dossierClientType(lead)).filter((item) => item.required)[1].key;
    addDossier(lead, lot, pre, { received: 3, validated: 1, rejected: [rejectedKey] });
  }
  {
    const lead = preLeads[4];
    const lot = takeLot(lead);
    const pre = addPreReservation(lead, lot, { createdAt: at(-9), validityDays: 7, status: "convertie", deposit: roundTo(lot.price * 0.05, 5_000) });
    const dossier = addDossier(lead, lot, pre, { received: "required", validated: 2 });
    createReservation(lead, lot, dossier, pre, { createdAt: at(-1, -5), discount: 40_000, discountReason: "Client recommandé par le réseau Konouz — geste commercial demandé à la direction." });
  }

  const wonPlans = [
    { signedDaysAgo: 200, bulletin: true },
    { signedDaysAgo: 95, bulletin: true, discount: 50_000, discountReason: "Paiement comptant de 40 % à la signature." },
    { signedDaysAgo: 35, bulletin: true },
    { signedDaysAgo: 8, bulletin: false },
  ];
  const won = wonLeads.map((lead, index) => {
    const plan = wonPlans[index];
    const lot = takeLot(lead);
    const signedAt = at(-plan.signedDaysAgo);
    const pre = addPreReservation(lead, lot, { createdAt: at(-plan.signedDaysAgo - 12), validityDays: 7, status: "convertie", deposit: roundTo(lot.price * 0.05, 5_000) });
    Object.assign(lead, { followUp1Date: shift(pre.createdAt, -20), followUp2Date: shift(pre.createdAt, -1) });
    const dossier = addDossier(lead, lot, pre, { received: "all", validated: "all" });
    const reservation = createReservation(lead, lot, dossier, pre, { createdAt: at(-plan.signedDaysAgo - 2), signedAt, bulletin: plan.bulletin, discount: plan.discount ?? 0, discountReason: plan.discountReason ?? "", approved: true });
    return { lead, lot, reservation };
  });

  const scheduleOf = (reservationId) => installments.filter((item) => item.reservationId === reservationId).sort((a, b) => a.order - b.order);
  const addPayment = (reservation, amount, { date, status, method = "virement", reference, installment, createdBy = "U2", rejectReason = null, note = "" }) => {
    const decided = !["en_attente_validation", "en_attente_encaissement"].includes(status);
    payments.push({
      id: `PAY${pad(payments.length + 1, 3)}`,
      reservationId: reservation.id,
      installmentId: installment?.id ?? null,
      amount,
      method,
      reference,
      proofFileName: `justificatif_${slug(reference)}.pdf`,
      date,
      status,
      note,
      createdBy,
      createdAt: date,
      validatedBy: decided || status === "en_attente_encaissement" ? "U5" : null,
      validatedAt: decided ? date : null,
      comment: "",
      rejectReason,
    });
  };

  {
    const { reservation, lead } = won[0];
    const [, compromis] = scheduleOf(reservation.id);
    addPayment(reservation, compromis.amount, { date: at(-186), status: "valide", reference: "VIR-AWB-118274", installment: compromis });
    setLeadStage(lead, "en_paiement", at(-186));
  }
  {
    const { reservation, lead } = won[1];
    const [, compromis, grosOeuvre] = scheduleOf(reservation.id);
    addPayment(reservation, compromis.amount, { date: at(-82), status: "valide", reference: "VIR-BMCE-552901", installment: compromis });
    addPayment(reservation, 150_000, { date: at(-3), status: "en_attente_encaissement", method: "cheque", reference: "CHQ 0048213", installment: grosOeuvre, createdBy: "U3", note: `Avance sur « ${grosOeuvre.label} »` });
    addPayment(reservation, 80_000, { date: at(-12), status: "rejete", method: "cheque", reference: "CHQ 0047990", installment: grosOeuvre, createdBy: "U3", rejectReason: "Chèque non signé, à représenter." });
    setLeadStage(lead, "en_paiement", at(-82));
  }
  {
    const { reservation, lead } = won[2];
    const [, compromis] = scheduleOf(reservation.id);
    addPayment(reservation, roundTo(compromis.amount * 0.6, 1_000), { date: at(-18), status: "valide", reference: "VIR-CIH-330187", installment: compromis });
    addPayment(reservation, compromis.amount - roundTo(compromis.amount * 0.6, 1_000), { date: at(-1), status: "en_attente_validation", reference: "VRS-ATW-77120", installment: compromis });
    setLeadStage(lead, "en_paiement", at(-18));
  }

  reservations.forEach((reservation) => recomputeReservation({ reservations, payments, installments, lots, lotHistory }, reservation.id));

  {
    const lead = lostLeads[0];
    const lot = lots.find((item) => item.projectId === lead.projectId && item.status === "disponible");
    addPreReservation(lead, lot, { createdAt: at(-40), validityDays: 7, status: "expiree", deposit: roundTo(lot.price * 0.05, 5_000) });
  }

  /* ---------------------------------------------------------------- */
  /* Notifications                                                    */
  /* ---------------------------------------------------------------- */

  const notifications = [];
  const notify = (notification) => notifications.push({ id: `N${notifications.length + 1}`, readBy: [], ...notification });
  const firstActive = preReservations.find((pre) => pre.status === "active");
  const activeLead = leads.find((lead) => lead.id === firstActive.leadId);
  const activeLot = lotById(firstActive.lotId);
  const pendingReservation = reservations.find((item) => item.status === "en_attente");
  const pendingLead = leads.find((lead) => lead.id === pendingReservation.leadId);

  notify({ type: "warning", title: "Pré-réservation bientôt expirée", message: `La pré-réservation ${firstActive.number} de ${activeLead.fullName} sur le lot ${activeLot.ref} expire dans moins de 6 heures.`, link: "/pre-reservations", roles: ["admin", "commercial"], at: at(0, -1) });
  notify({ type: "info", title: "Paiement à valider", message: `Virement reçu pour ${won[2].reservation.number} (${won[2].lead.fullName}).`, link: "/paiements", roles: ["admin", "comptable"], at: at(-1) });
  notify({ type: "info", title: "Chèque en attente d'encaissement", message: `Chèque de 150 000 MAD reçu pour ${won[1].reservation.number} (${won[1].lead.fullName}).`, link: "/paiements", roles: ["admin", "comptable"], at: at(-3) });
  notify({ type: "danger", title: "Échéance en retard", message: `« Achèvement du gros œuvre » de ${won[0].reservation.number} n'est pas réglée.`, link: `/echeancier?reservationId=${won[0].reservation.id}`, roles: ["admin", "direction", "comptable", "commercial"], at: at(-2) });
  notify({ type: "warning", title: "Remise à approuver", message: `${pendingReservation.number} — ${pendingLead.fullName} : remise de ${pendingReservation.discount.toLocaleString("fr-FR")} MAD demandée.`, link: `/reservations/${pendingReservation.id}`, roles: ["admin", "direction"], at: at(-1, -5) });
  notify({ type: "success", title: "Réservation signée", message: `${won[3].reservation.number} — ${won[3].lead.fullName}, lot ${won[3].lot.ref}. Bulletin à générer.`, link: `/reservations/${won[3].reservation.id}`, roles: null, at: at(-8) });
  notify({ type: "info", title: "Nouveau lead à affecter", message: `${leads[0].fullName} attend d'être affecté à un commercial.`, link: `/leads/${leads[0].id}`, roles: ["admin"], at: leads[0].createdAt });
  notify({ type: "info", title: "Lot bloqué", message: "Le lot R-603 (Résidence Al Andalous) est bloqué pour réserve technique.", link: "/lots?projectId=PJ3", roles: ["admin", "chef_projet"], at: at(-6), readBy: users.map((user) => user.id) });

  return {
    users,
    credentials,
    sessions: {},
    promoters,
    projects,
    tranches,
    buildings,
    lots,
    lotHistory,
    sources,
    leads,
    contacts,
    activities,
    preReservations,
    dossiers,
    reservations,
    installments,
    payments,
    notifications,
    counters,
  };
}
