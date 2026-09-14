// ─── Modèles NKS — alignés sur les DTOs Spring Boot ─────────────────────────

export interface LoginRequest { email: string; motDePasse: string; }
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  roles: string[];
  /** true si le candidat n'a pas encore accepté le Recueil de consentement — à rediriger
   *  systématiquement vers /mon-espace/consentement avant toute autre page. */
  consentementRequis: boolean;
}

export interface CandidatPublicResponse {
  id: string;
  codeCandidat: string;
  prenom: string;
  nom: string;
  biographie: string | null;
  chansonPreselection: string;
  statutProfil: StatutProfilCandidat;
  /**
   * Absent de CandidatPublicResponse côté backend (GAP-01) : jamais renvoyé par l'API.
   * Rempli côté client après un appel séparé à MediaService.mediasCandidat() (depuis
   * le 09/08/2026, GET /medias/candidat/{id} existe — cf. MediaController.java).
   */
  photoUrl?: string | null;
}

/**
 * bf.laterrasse.nks.dto.media.MediaPublicResponse — GET /medias/candidat/{candidatId}.
 * Ajouté le 09/08/2026 (GAP-01 comblé, autorisation explicite utilisateur pour ce cas précis).
 */
export interface MediaPublicResponse {
  id: string;
  candidatId: string;
  type: 'PHOTO_PROFIL' | 'CAPTURE_SOCIAL';
  urlStockage: string | null;
  format: string;
  statut: 'EN_ATTENTE' | 'VALIDE' | 'MASQUE';
  dateUpload: string;
}

export interface VoteCompteur {
  votesPayants: number;
  votesSociaux: number;
  votesSurPlace: number;
  total: number;
}

export interface InitierVoteRequest {
  candidatId: string;
  phaseId: string;
  nbVotes: number;
  telephone: string;
}

/**
 * Contrat exact de bf.laterrasse.nks.dto.vote.InitierVoteResponse.
 * L'ancienne version (transactionId / montant / statut) ne correspondait à
 * aucun champ renvoyé : le montant affiché après paiement était `undefined`.
 */
export interface InitierVoteResponse {
  paiementId: string;
  /** Page de paiement LigdiCash : c'est là que l'opérateur est choisi */
  urlPaiement: string;
  montantTotal: number;
  expireDansSecondes: number;
}

export interface CandidatureSubmitRequest {
  prenom: string;
  nom: string;
  dateNaissance: string; // ISO date
  telephone: string;
  email: string;
  chansonPreselection: string;
  motivation: string;
  urlPhoto: string;
  formatPhoto: string;
  taillePhotoOctets: number;
  urlVideo: string;
  dureeVideoSecondes: number;
  tailleVideoOctets: number;
  urlCaptureSocial: string;
  editionId: string;
  /**
   * Consentement RGPD (10/09/2026) — CandidatureSubmitRequest.java n'a pas encore ces deux
   * champs : envoyés dès aujourd'hui (Jackson ignore les champs inconnus par défaut, donc
   * sans risque), mais le backend doit les lire ET arrêter de coder en dur
   * `.consentementRgpd(true)` (CandidatureService.java:325) pour qu'ils aient un effet réel.
   * Bloqués côté frontend (Validators.requiredTrue) en attendant.
   */
  accepteReglement: boolean;
  accepteConfidentialite: boolean;
}

/** Réponse réelle de POST /candidatures — CandidatureSubmitResponse.java (3 champs) */
export interface CandidatureSubmitResponse {
  id: string;
  codeCandidat: string;
  statut: StatutCandidature;
}

export interface CandidatureDetailResponse {
  id: string;
  codeCandidat: string;
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  statut: StatutCandidature;
  motivation: string | null;
  captureFbTiktokUrl: string | null;
  dateSoumission: string;
  motifRejet: string | null;
}

/**
 * Partenaire — entité JPA sérialisée telle quelle par PartenaireController.
 * Les champs de contact sont exposés par le backend mais ne doivent jamais
 * être affichés côté public (données personnelles, CdC §6.2).
 */
export interface Partenaire {
  id: string;
  nom: string;
  logoUrl: string | null;
  description: string | null;
  siteWebUrl: string | null;
  niveauPartenariat: NiveauPartenariat | null;
  contactNom: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  statut: 'ACTIF' | 'INACTIF';
}

export type NiveauPartenariat = 'TITRE' | 'OR' | 'ARGENT' | 'PARTENAIRE';

export interface Edition {
  id: string;
  nom: string;
  annee: number;
  statut: StatutEdition;
  dateDebutInscriptions: string;
  dateFinInscriptions: string;
  dateDebutCompetition: string;
  dateFinCompetition: string;
  description: string | null;
}

export interface Phase {
  id: string;
  nom: NomPhase;
  /** Ordre d'affichage/déroulement des phases (Short backend) — requis à la création */
  ordre?: number;
  /**
   * Champ libre côté backend (`VARCHAR(30) NOT NULL`, pas de contrainte `CHECK` contrairement à `nom`
   * — cf. Phase.java `@Column(name = "type_phase", nullable = false)`).
   * Convention front : 'INDIVIDUEL' | 'DUO'. NOT NULL en base → toujours envoyé à la création,
   * y compris pour PRESELECTION (forcé à 'INDIVIDUEL', le sélecteur y est masqué côté UI car
   * cette phase est une candidature sans notion individuel/duo ni vote jury).
   * IGNORÉ par PUT /phases/{id} (PhaseController.mettreAJour ne le lit pas) — non modifiable
   * après création depuis l'admin.
   */
  typePhase?: 'INDIVIDUEL' | 'DUO' | string;
  statut: StatutPhase;
  dateDebut: string;
  dateFin: string;
  voteActif: boolean;
  poidsVotesEnLigne: number;
  poidsPublicSurPlace: number;
  poidsJury: number;
  pointsMaxVotesEnLigne: number;
  pointsMaxPublic: number;
  pointsMaxJury: number;
  juryObligatoire?: boolean;
  /**
   * Date limite (purement informative, jamais bloquante) pour que chaque candidat choisisse
   * son titre imposé + déclare son titre personnel avant sa manche — cf. Phase.dateLimiteChoixTitres
   * (backend) et ChoixTitreService (§ échange du 13/09/2026). `null`/absent = pas de délai affiché.
   */
  dateLimiteChoixTitres?: string | null;
}

/** TitreImposeResponse (bf.laterrasse.nks.dto.titre) — une ligne de la liste imposée par le CO pour une phase. */
export interface TitreImpose {
  id: string;
  titre: string;
  ordre: number;
}

/** ChoixTitreResponse — choix déjà fait par le candidat connecté pour sa soirée à venir. */
export interface ChoixTitre {
  titreImposeId: string;
  titreImpose: string;
  titrePersonnel: string;
  dateChoix: string;
}

/** MonChoixTitreResponse — GET /candidats/mon-choix-titre. */
export interface MonChoixTitre {
  soireeId: string | null;
  soireeNom: string | null;
  soireeDateHeure: string | null;
  phaseNom: string | null;
  dateLimiteChoixTitres: string | null;
  titresDisponibles: TitreImpose[];
  choixActuel: ChoixTitre | null;
}

/** StatutChoixTitreCandidatResponse — une ligne du rapport admin GET /admin/phases/{phaseId}/choix-titres. */
export interface StatutChoixTitreCandidat {
  candidatId: string;
  codeCandidat: string;
  nomComplet: string;
  soireeId: string;
  soireeNom: string;
  choisi: boolean;
  titreImpose: string | null;
  titrePersonnel: string | null;
  dateChoix: string | null;
  enRetard: boolean;
}

/** Poule — bf.laterrasse.nks.dto.poule.PouleResponse. Listable via GET /poules/phase/{phaseId}. */
export interface PouleResponse {
  id: string;
  phaseId: string;
  nom: string;
  soireeId: string | null;
  dateCreation: string;
}

/** bf.laterrasse.nks.dto.poule.AffectationPouleResponse */
export interface AffectationPouleResponse {
  id: string;
  candidat: CandidatPublicResponse;
  pouleId: string;
  ordrePassage: number | null;
  chansonImposee: string | null;
}

/** bf.laterrasse.nks.dto.poule.DuoResponse — listable via GET /duos/phase/{phaseId}. */
export interface DuoResponse {
  id: string;
  phaseId: string;
  soireeId: string | null;
  candidat1: CandidatPublicResponse;
  candidat2: CandidatPublicResponse;
  chansonCommune: string | null;
  ordrePassage: number | null;
}

export interface SoireeEvent {
  id: string;
  nom: string;
  dateHeure: string;
  lieu: string;
  adresse: string | null;
  capaciteMax: number;
  statut: StatutSoiree;
  voteSurPlaceActif: boolean;
  /**
   * Contrôle GET /candidats/{id}/scores côté backend (jointure sur la soirée
   * de la phase — ResultatPhaseRepository.findByCandidatIdEtResultatsPublies) :
   * un candidat ne voit ses résultats de phase que si la soirée correspondante
   * a ce champ à true. Absent du formulaire d'édition avant le 10/09/2026 —
   * aucun moyen pour l'admin de l'activer autrement qu'en base.
   */
  resultatsPublies: boolean;
  /**
   * Seuil de consommations réelles au bar donnant droit à +1 vote bonus (au-delà du vote de
   * base offert à l'entrée) — configurable par soirée par l'admin. `null` = fonctionnalité
   * désactivée pour cette soirée (pas de votes bonus).
   */
  nbConsommationsPourVoteBonus: number | null;
  /** Plafond de votes bonus par billet — `null` = pas de plafond. */
  plafondVotesBonus: number | null;
}

export interface Classement {
  id: string;
  candidatId: string;
  codeCandidat: string;
  rangGlobal: number;
  totalPointsCumules: number;
  officiel: boolean;
}

export interface ResultatPhase {
  id: string;
  candidatId: string;
  codeCandidat: string;
  /** ResultatPhaseResponse.phaseId côté backend — jamais mappé côté front avant (GAP audit panel candidat) */
  phaseId: string;
  /** ResultatPhaseResponse.nomPhase — nom brut de l'enum Phase.nom (ex. "ELIMINATOIRES"), à passer par un libellé FR avant affichage */
  nomPhase: NomPhase;
  rang: number;
  pointsVotesEnLigne: number;
  pointsJury: number;
  pointsPublicSurPlace: number;
  totalPoints: number;
  statutQualification: StatutQualification;
}

/**
 * bf.laterrasse.nks.dto.video.VideoPublicResponse — noms de champs vérifiés contre le DTO Java.
 * ⚠️ `urlStreaming` n'est JAMAIS renseigné côté backend (ni CandidatureService.soumettre() ni
 * VideoService.uploaderPourPhase() ne l'écrivent — seul `urlStockageOriginale`, qui n'est PAS
 * exposé par ce DTO, est rempli). Conséquence : ce champ vaut systématiquement `null` en
 * production aujourd'hui, quelle que soit la vidéo. Toute UI qui l'utilise doit gérer ce cas
 * comme la normale, pas comme une erreur ponctuelle — c'est un gap backend, pas un bug d'affichage.
 */
export interface Video {
  id: string;
  candidatId?: string;
  phaseId?: string | null;
  urlStreaming: string | null;
  urlThumbnail: string | null;
  titreChanson: string;
  dureeSecondes: number;
  statut: StatutVideo;
  dateUpload: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  fields: Record<string, string>;
  expiresInSeconds: number;
  publicId: string;
}

export interface CategorieTicket {
  id: string;
  nom: string;
  prix: number;
  nbPlacesDisponibles: number;
  nbPlacesReservees: number;
}

export interface ReservationRequest {
  soireeId: string;
  categorieId: string;
  nbPlaces: number;
  nomReservant: string;
  telephoneReservant: string;
  emailReservant?: string;
}

export interface ReservationResponse {
  reservationId: string;
  paiementId: string;
  urlPaiement: string;
  montantTotal: number;
  statut: string;
  /**
   * Jeton d'accès "post-achat" (13/09/2026, fix IDOR billetterie) — scopé à CETTE
   * réservation précise, `scope=["read"]` uniquement (pas "cancel", pas mes-tickets).
   * Utilisable immédiatement pour GET /reservations/{id}/ticket sans passer par l'OTP.
   * ⚠️ Ne JAMAIS mettre dans une URL/query string — header X-Ticket-Access-Token
   * uniquement, stocké en sessionStorage (jamais localStorage) côté client.
   */
  ticketAccessToken: string;
  /** Durée de vie du ticketAccessToken en secondes (~1500s / 25min). */
  ticketAccessTokenExpiresIn: number;
}

/** Réponse générique de POST /reservations/mes-tickets/otp/demander — toujours 200. */
export interface OtpDemandeResponse {
  message: string;
}

/**
 * Réponse de POST /reservations/mes-tickets/otp/verifier — jeton "phone-wide"
 * (scope=["read","cancel"]), valable pour toutes les réservations de ce numéro.
 * ⚠️ Ne JAMAIS mettre dans une URL — header X-Ticket-Access-Token uniquement,
 * gardé en mémoire composant (pas de sessionStorage/localStorage pour ce jeton-là).
 */
export interface OtpVerifierResponse {
  accessToken: string;
  expiresInSeconds: number;
}

export interface Reservation {
  id: string;
  soireeId: string;
  nomReservant: string;
  telephoneReservant: string;
  nbPlaces: number;
  statut: StatutReservation;
  qrCodeUrl?: string;
  qrUuid?: string;
}

/**
 * bf.laterrasse.nks.dto.billetterie.TicketAvecQrResponse — GET /reservations/{id}/ticket?telephone=.
 * Un élément par billet physique de la réservation (nbPlaces=3 → 3 éléments, 3 qrUuid distincts).
 * ⚠️ Volontairement distinct de `Reservation.qrUuid` (jamais renseigné par mes-tickets, cf.
 * commentaire backend sur TicketAvecQrResponse : la recherche par téléphone seul ne doit jamais
 * exposer de qrUuid).
 *
 * `statut` : EXPIRE ajouté côté serveur quand la soirée du billet passe à TERMINEE (clôture
 * admin) et que le billet n'a jamais été consommé — cf. tickets.component.html pour le rendu.
 */
export interface TicketAvecQr {
  ticketId: string;
  qrUuid: string;
  nomSpectateur: string;
  statut: 'EMIS' | 'UTILISE' | 'EXPIRE' | 'ANNULE';
}

export interface ScanResponse {
  resultat: 'VALIDE' | 'INVALIDE' | 'DEJA_UTILISE';
  nomSpectateur: string | null;
  nbPlaces: number | null;
  timestampPremierScan: string | null;
}

/** Candidat éligible au vote sur place — dto/candidat/CandidatPublicResponse.java */
export interface CandidatVoteSurPlace {
  id: string;
  codeCandidat: string;
  prenom: string;
  nom: string;
  biographie: string | null;
  chansonPreselection: string | null;
  statutProfil: string;
}

/** dto/votesurplace/DroitVoteResponse.java — un vote déjà exprimé (historique). */
export interface VoteExprimeResponse {
  candidatId: string;
  candidatCode: string;
  dateVote: string;
}

/**
 * dto/votesurplace/DroitVoteResponse.java — GET/POST /vote-sur-place et POST /caisse/consommations.
 * Contrat cassant du 14/09/2026 (votes bonus liés à la consommation) : un billet peut désormais
 * donner droit à 0, 1 ou plusieurs votes (1 de base + N bonus selon la consommation au bar).
 * `candidats` n'est renseigné que si `nbVotesDisponibles > 0` (au moins un vote encore possible).
 */
export interface DroitVoteResponse {
  nomSpectateur: string;
  nbVotesDisponibles: number;
  nbVotesTotal: number;
  votesExprimes: VoteExprimeResponse[];
  candidats: CandidatVoteSurPlace[];
}

/**
 * dto/caisse/ConsommationBonusResponse.java — POST /caisse/consommations-bonus.
 * Enregistre une consommation supplémentaire (hors entrée) et calcule si elle débloque un
 * nouveau vote bonus (tranche de `seuil` consommations, jusqu'à `plafond` si défini).
 */
export interface ConsommationBonusResponse {
  nbConsommationsSupplementaires: number;
  seuil: number;
  plafond: number | null;
  nbVotesBonusDebloquesAuTotal: number;
  nouveauVoteDebloque: boolean;
  nbVotesDisponiblesTotal: number;
}

export interface DashboardResponse {
  candidatsTotal: number;
  candidatsValides: number;
  candidatsEnAttente: number;
  candidatsEnAttentePaiement: number;
  candidatsRejetes: number;
  votesTotauxParPhase: Record<string, number>;
  revenusInscriptions: number;
  revenusVotes: number;
  revenusBillets: number;
  tauxRemplissageMoyenSoirees: number;
}

export interface DashboardOrganisateurResponse {
  candidatsTotal: number;
  candidatsValides: number;
  candidatsEnAttente: number;
  candidatsEnAttentePaiement: number;
  candidatsRejetes: number;
  votesTotauxParPhase: Record<string, number>;
  tauxRemplissageMoyenSoirees: number;
}

// NOTE: Les interfaces jury (CritereNotation, JuryDashboardData, CandidatANoter,
// NoteJuryRequest/Response) ont été supprimées car elles ne correspondaient pas
// aux DTOs réels du backend. Les types corrects sont dans jury.service.ts :
//   → CritereLocal (inline dans notation.component)
//   → CandidatBrut, NoteJuryBrut, SaisirNotesRequest (jury.service.ts)

// ─── Enums (alignés sur Enums.java) ──────────────────────────────────────────
export type StatutProfilCandidat = 'EN_ATTENTE' | 'ACTIF' | 'SUSPENDU' | 'ELIMINE' | 'FINALISTE' | 'GAGNANT';
export type StatutCandidature    = 'EN_ATTENTE' | 'VALIDEE' | 'REJETEE' | 'EN_ATTENTE_PAIEMENT' | 'ACTIVE';
export type StatutEdition        = 'EN_PREPARATION' | 'EN_COURS' | 'TERMINEE' | 'ARCHIVEE';
export type NomPhase             = 'PRESELECTION' | 'ELIMINATOIRES' | 'DEMI_FINALE' | 'FINALE';
export type StatutPhase          = 'EN_ATTENTE' | 'EN_COURS' | 'TERMINEE';
export type StatutSoiree         = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
export type StatutReservation    = 'PENDING' | 'CONFIRMEE' | 'ANNULEE' | 'EXPIREE';
export type StatutQualification  = 'QUALIFIE' | 'ELIMINE' | 'REPECHAGE' | 'EN_ATTENTE';
export type StatutVideo          = 'EN_COURS_UPLOAD' | 'DISPONIBLE' | 'MASQUEE';

// ─── Pagination Spring ────────────────────────────────────────────────────────
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;  // page courante (0-based)
  size: number;
}
