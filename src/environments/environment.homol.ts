export const environment = {
  production: false,
  apiUrl: 'https://nks-homologation.jcloud-ver-jpe.ik-server.com/api/v1',
  votePriceFcfa: 100,
  // Valeur de secours — GET /parametres/publics est la source de vérité (ParametresService).
  inscriptionPriceFcfa: 15_000,
  maxVotesPerHour: 20,
  pollIntervalMs: 60_000,
};
