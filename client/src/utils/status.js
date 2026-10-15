const toMap = (list) => Object.fromEntries(list.map((item) => [item.value, item]));

export const LEAD_STAGES = [
  { value: "nouveau", label: "Nouveau", tone: "neutral", color: "#b3a99e" },
  { value: "affecte", label: "Affecté", tone: "neutral", color: "#8f8378" },
  { value: "contacte", label: "Contacté", tone: "info", color: "#6d8fb0" },
  { value: "qualifie", label: "Qualifié", tone: "info", color: "#4f78a0" },
  { value: "en_visite", label: "En visite", tone: "info", color: "#2d5d88" },
  { value: "en_negociation", label: "En négociation", tone: "warning", color: "#c98a12" },
  { value: "pre_reserve", label: "Pré-réservé", tone: "gold", color: "#faae1c" },
  { value: "reserve", label: "Réservé", tone: "gold", color: "#e09a0e" },
  { value: "signe", label: "Signé", tone: "success", color: "#3f9461" },
  { value: "en_paiement", label: "En paiement", tone: "success", color: "#2c7a4b" },
  { value: "livre", label: "Livré", tone: "brand", color: "#5a4030" },
  { value: "cloture", label: "Clôturé", tone: "brand", color: "#3d2b1f" },
  { value: "annule", label: "Annulé", tone: "danger", color: "#b42318" },
];
export const LEAD_STAGE = toMap(LEAD_STAGES);
export const LEAD_STAGE_ORDER = LEAD_STAGES.map((stage) => stage.value);
/** Stages driven by the sales workflow (pre-reservation, reservation, payments), not set by hand. */
export const ENGAGED_STAGES = ["pre_reserve", "reserve", "signe", "en_paiement"];
/** Stages a user may pick by hand from the lead page. */
export const MANUAL_STAGES = ["nouveau", "affecte", "contacte", "qualifie", "en_visite", "en_negociation"];
export const CLOSED_STAGES = ["livre", "cloture", "annule"];

export const FOLLOW_UP_OUTCOMES = [
  { value: "en_reflexion", label: "En réflexion", tone: "info", next: "Relance" },
  { value: "rendez_vous", label: "Rendez-vous", tone: "gold", next: "Relance" },
  { value: "reservation", label: "Réservation", tone: "success", next: "Relance" },
  { value: "concretisation", label: "Concrétisation", tone: "success", next: "Relance" },
  { value: "annulation", label: "Annulation", tone: "danger", next: "Archivage" },
];
export const FOLLOW_UP_OUTCOME = toMap(FOLLOW_UP_OUTCOMES);

export const CLIENT_TYPES = [
  { value: "particulier", label: "Particulier" },
  { value: "societe", label: "Société" },
];
export const CLIENT_TYPE = toMap(CLIENT_TYPES);

export const DOSSIER_CLIENT_TYPES = [
  ...CLIENT_TYPES,
  { value: "etranger", label: "Étranger" },
  { value: "indivision", label: "Indivision" },
];
export const DOSSIER_CLIENT_TYPE = toMap(DOSSIER_CLIENT_TYPES);

export const FINANCING_MODES = [
  { value: "comptant", label: "Comptant" },
  { value: "credit", label: "Crédit" },
  { value: "aide_etat", label: "Aide de l'État" },
];
export const FINANCING_MODE = toMap(FINANCING_MODES);

export const PURCHASE_DELAYS = ["Immédiat", "1 mois", "3 mois", "6 mois", "Plus de 6 mois"];
export const MOTIVATIONS = ["Résidence principale", "Résidence secondaire", "Investissement locatif", "Local professionnel"];

export const CONTACT_CHANNELS = [
  { value: "telephone", label: "Téléphone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "visite", label: "Visite" },
  { value: "autre", label: "Autre" },
];
export const CONTACT_CHANNEL = toMap(CONTACT_CHANNELS);

export const CONTACT_RESULTS = [
  { value: "contact_etabli", label: "Contact établi", tone: "success" },
  { value: "sans_reponse", label: "Sans réponse", tone: "neutral" },
  { value: "numero_errone", label: "Numéro erroné", tone: "danger" },
  { value: "rappel_demande", label: "Rappel demandé", tone: "warning" },
  { value: "non_interesse", label: "Non intéressé", tone: "danger" },
  { value: "rdv_fixe", label: "RDV fixé", tone: "gold" },
  { value: "autre", label: "Autre", tone: "neutral" },
];
export const CONTACT_RESULT = toMap(CONTACT_RESULTS);

export const PROJECT_TYPES = [
  { value: "residence", label: "Résidence" },
  { value: "lotissement", label: "Lotissement" },
  { value: "galerie_commerce", label: "Galerie commerce" },
];
export const PROJECT_TYPE = toMap(PROJECT_TYPES);

export const LOT_TYPES = [
  { value: "f2", label: "F2" },
  { value: "f3", label: "F3" },
  { value: "f4", label: "F4" },
  { value: "duplex", label: "Duplex" },
  { value: "villa", label: "Villa" },
  { value: "lot", label: "Lot" },
  { value: "commerce", label: "Commerce" },
];
export const LOT_TYPE = toMap(LOT_TYPES);
/** Project "consistance" options, as listed in the client's project sheet. */
export const CONSISTANCE_OPTIONS = [
  { value: "f2", label: "F2" },
  { value: "f3", label: "F3" },
  { value: "f4", label: "F4" },
  { value: "duplex", label: "Duplex" },
  { value: "villa", label: "Villa" },
  { value: "lot", label: "Lots" },
  { value: "commerce", label: "Commerces" },
];

export const LOT_STATUSES = [
  { value: "disponible", label: "Disponible", tone: "success", color: "#2c7a4b" },
  { value: "pre_reserve", label: "Pré-réservé", tone: "gold", color: "#faae1c" },
  { value: "reserve", label: "Réservé", tone: "info", color: "#2d5d88" },
  { value: "vendu", label: "Vendu", tone: "brand", color: "#3d2b1f" },
  { value: "bloque", label: "Bloqué", tone: "neutral", color: "#b3a99e" },
];
export const LOT_STATUS = toMap(LOT_STATUSES);

export const PRE_RESERVATION_STATUSES = [
  { value: "active", label: "Active", tone: "gold" },
  { value: "convertie", label: "Convertie en dossier", tone: "success" },
  { value: "expiree", label: "Expirée", tone: "danger" },
  { value: "annulee", label: "Annulée", tone: "neutral" },
];
export const PRE_RESERVATION_STATUS = toMap(PRE_RESERVATION_STATUSES);

export const DOCUMENT_STATUSES = [
  { value: "manquant", label: "Manquante", tone: "neutral" },
  { value: "en_attente", label: "En attente", tone: "info" },
  { value: "valide", label: "Validée", tone: "success" },
  { value: "rejete", label: "Rejetée", tone: "danger" },
];
export const DOCUMENT_STATUS = toMap(DOCUMENT_STATUSES);

export const DOCUMENT_CATEGORIES = {
  identite: "Identité",
  revenus: "Revenus",
  juridique: "Juridique",
  bancaire: "Bancaire",
  paiement: "Paiement",
  domicile: "Domicile",
};

export const DOSSIER_STATUSES = [
  { value: "en_cours", label: "En cours", tone: "neutral" },
  { value: "incomplet", label: "Incomplet", tone: "warning" },
  { value: "complet", label: "Complet", tone: "info" },
  { value: "valide", label: "Validé", tone: "success" },
  { value: "rejete", label: "Rejeté", tone: "danger" },
];
export const DOSSIER_STATUS = toMap(DOSSIER_STATUSES);

export const RESERVATION_STATUSES = [
  { value: "en_attente", label: "En attente", tone: "warning" },
  { value: "active", label: "Active", tone: "success" },
  { value: "annulee", label: "Annulée", tone: "danger" },
  { value: "desistement", label: "Désistement", tone: "danger" },
  { value: "change_ref", label: "Changement de référence", tone: "info" },
  { value: "resiliation", label: "Résiliation", tone: "danger" },
  { value: "cloturee", label: "Clôturée", tone: "brand" },
];
export const RESERVATION_STATUS = toMap(RESERVATION_STATUSES);
/** End states an admin or the direction can apply to an active reservation. */
export const RESERVATION_END_STATUSES = ["desistement", "change_ref", "resiliation", "cloturee"];

export const PAYMENT_STATUSES = [
  { value: "en_attente_validation", label: "À valider", tone: "warning" },
  { value: "en_attente_encaissement", label: "En attente d'encaissement", tone: "info" },
  { value: "valide", label: "Validé", tone: "success" },
  { value: "rejete", label: "Rejeté", tone: "danger" },
];
export const PAYMENT_STATUS = toMap(PAYMENT_STATUSES);
export const PENDING_PAYMENT_STATUSES = ["en_attente_validation", "en_attente_encaissement"];

export const PAYMENT_METHODS = [
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "cheque_certifie", label: "Chèque certifié" },
  { value: "especes", label: "Espèces" },
  { value: "electronique", label: "Paiement électronique" },
];
export const PAYMENT_METHOD = toMap(PAYMENT_METHODS);

export const INSTALLMENT_STATUSES = [
  { value: "a_venir", label: "À venir", tone: "neutral" },
  { value: "en_attente", label: "Paiement en attente", tone: "info" },
  { value: "partiellement_payee", label: "Partiellement payée", tone: "info" },
  { value: "payee", label: "Payée", tone: "success" },
  { value: "en_retard", label: "En retard", tone: "danger" },
  { value: "annulee", label: "Annulée", tone: "neutral" },
];
export const INSTALLMENT_STATUS = toMap(INSTALLMENT_STATUSES);

export const labelOf = (map, value) => map[value]?.label ?? value ?? "—";
