// URL relative : le proxy Angular (proxy.conf.json, ng serve --proxy-config) redirige
// /api/v1/** vers http://localhost:8082 côté serveur de dev. Ça marche identiquement en
// localhost, via IP LAN, ou via un tunnel HTTPS public (loca.lt) — toujours même origine
// que la page, donc jamais de blocage CORS/"accès réseau local" côté navigateur.
export const environment = {
  production: false,
  apiUrl: '/api/v1',
  votePriceFcfa: 100,
  // Aucun endpoint backend n'expose PRIX_INSCRIPTION_FCFA (parametres_plateforme n'est
  // servi par aucun contrôleur). À remplacer par la valeur serveur dès qu'elle est exposée.
  inscriptionPriceFcfa: 15_000,
  maxVotesPerHour: 20,
  pollIntervalMs: 60_000,
};
