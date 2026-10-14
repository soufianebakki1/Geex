export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const FALLBACK_MESSAGES = {
  400: "La requête est invalide.",
  401: "Votre session a expiré. Veuillez vous reconnecter.",
  403: "Vous n'avez pas les droits nécessaires pour cette action.",
  404: "Élément introuvable.",
  409: "Cette action entre en conflit avec l'état actuel des données.",
  422: "Certaines informations sont invalides.",
  500: "Le serveur a rencontré une erreur.",
};

export function defaultMessage(status) {
  return FALLBACK_MESSAGES[status] ?? "Une erreur inattendue est survenue.";
}

export function errorMessage(error) {
  if (!error) return "";
  if (error instanceof TypeError) return "Impossible de joindre le serveur. Vérifiez votre connexion.";
  return error.message || "Une erreur inattendue est survenue.";
}
