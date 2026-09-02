export const environment = {
  production: true,
  apiUrl: 'https://nks-backend.jcloud-ver-jpe.ik-server.com/api/v1',
  votePriceFcfa: 100,
  // Aucun endpoint backend n'expose PRIX_INSCRIPTION_FCFA (parametres_plateforme n'est
  // servi par aucun contrôleur). À remplacer par la valeur serveur dès qu'elle est exposée.
  inscriptionPriceFcfa: 15_000,
  maxVotesPerHour: 20,
  pollIntervalMs: 60_000,
};
