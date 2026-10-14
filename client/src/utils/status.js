const toMap = (list) => Object.fromEntries(list.map((item) => [item.value, item]));

export const LEAD_STAGES = [
  { value: "nouveau", label: "Nouveau", tone: "neutral", color: "#b3a99e" },
  { value: "contacte", label: "Contacté", tone: "info", color: "#6d8fb0" },
  { value: "visite", label: "Visite", tone: "info", color: "#2d5d88" },
  { value: "negociation", label: "Négociation", tone: "warning", color: "#c98a12" },
  { value: "pre_reserve", label: "Pré-réservé", tone: "gold", color: "#faae1c" },
  { value: "gagne", label: "Gagné", tone: "success", color: "#2c7a4b" },
  { value: "perdu", label: "Perdu", tone: "danger", color: "#b42318" },
];
export const LEAD_STAGE = toMap(LEAD_STAGES);
export const ENGAGED_STAGES = ["pre_reserve", "gagne"];

export const LEAD_SOURCES = ["Facebook", "Instagram", "TikTok", "LinkedIn", "Panneau publicitaire", "Kakémono", "Emailing / SMS", "Évènementiel", "Brochure / Flyer", "Réseau Konouz", "Site web", "Appel entrant"];

export const CONTACT_TYPES = [
  { value: "appel", label: "Appel" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "visite", label: "Visite" },
  { value: "rdv", label: "Rendez-vous" },
];
export const CONTACT_TYPE = toMap(CONTACT_TYPES);

export const LOT_STATUSES = [
  { value: "disponible", label: "Disponible", tone: "success", color: "#2c7a4b" },
  { value: "pre_reserve", label: "Pré-réservé", tone: "gold", color: "#faae1c" },
  { value: "reserve", label: "Réservé", tone: "info", color: "#2d5d88" },
  { value: "vendu", label: "Vendu", tone: "brand", color: "#3d2b1f" },
  { value: "bloque", label: "Bloqué", tone: "neutral", color: "#b3a99e" },
];
export const LOT_STATUS = toMap(LOT_STATUSES);
export const LOT_TYPES = ["Appartement", "Villa", "Commerce", "Bureau"];

export const PROJECT_STATUSES = [
  { value: "en_commercialisation", label: "En commercialisation", tone: "gold" },
  { value: "en_construction", label: "En construction", tone: "info" },
  { value: "livre", label: "Livré", tone: "success" },
];
export const PROJECT_STATUS = toMap(PROJECT_STATUSES);
export const PROJECT_TYPES = ["Résidentiel", "Villas", "Mixte"];

export const PRE_RESERVATION_STATUSES = [
  { value: "active", label: "Active", tone: "gold" },
  { value: "convertie", label: "Convertie en dossier", tone: "success" },
  { value: "expiree", label: "Expirée", tone: "danger" },
  { value: "annulee", label: "Annulée", tone: "neutral" },
];
export const PRE_RESERVATION_STATUS = toMap(PRE_RESERVATION_STATUSES);

export const DOCUMENT_STATUSES = [
  { value: "manquant", label: "Manquante", tone: "neutral" },
  { value: "recu", label: "Reçue", tone: "info" },
  { value: "valide", label: "Validée", tone: "success" },
];
export const DOCUMENT_STATUS = toMap(DOCUMENT_STATUSES);

export const DOSSIER_STATUSES = [
  { value: "incomplet", label: "Incomplet", tone: "warning" },
  { value: "complet", label: "Complet", tone: "info" },
  { value: "valide", label: "Validé", tone: "success" },
  { value: "annule", label: "Annulé", tone: "danger" },
];
export const DOSSIER_STATUS = toMap(DOSSIER_STATUSES);

export const RESERVATION_STATUSES = [
  { value: "en_attente", label: "À confirmer", tone: "warning" },
  { value: "confirmee", label: "Confirmée", tone: "success" },
  { value: "annulee", label: "Annulée", tone: "danger" },
];
export const RESERVATION_STATUS = toMap(RESERVATION_STATUSES);

export const PAYMENT_STATUSES = [
  { value: "en_attente", label: "À valider", tone: "warning" },
  { value: "valide", label: "Validé", tone: "success" },
  { value: "rejete", label: "Rejeté", tone: "danger" },
];
export const PAYMENT_STATUS = toMap(PAYMENT_STATUSES);
export const PAYMENT_METHODS = ["Virement", "Chèque", "Chèque certifié", "Versement bancaire", "Espèces", "Paiement électronique"];

export const INSTALLMENT_STATUSES = [
  { value: "paye", label: "Réglée", tone: "success" },
  { value: "partiel", label: "Partielle", tone: "info" },
  { value: "a_venir", label: "À venir", tone: "neutral" },
  { value: "en_retard", label: "En retard", tone: "danger" },
];
export const INSTALLMENT_STATUS = toMap(INSTALLMENT_STATUSES);
