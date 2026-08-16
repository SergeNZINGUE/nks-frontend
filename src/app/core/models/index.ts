// ─── Modèles NKS — alignés sur les DTOs Spring Boot ─────────────────────────

export interface LoginRequest { email: string; motDePasse: string; }
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  roles: string[];
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
}

/**
 * Poule — bf.laterrasse.nks.dto.poule.PouleResponse.
 * ⚠️ Pas de GET /poules?phaseId ni GET /phases/{id}/poules côté backend (PouleDuoController) :
 * une poule n'est retrouvable qu'à sa création (réponse du POST) ou via son id déjà connu
 * (GET /poules/{id}/candidats). Impossible de lister les poules existantes d'une phase après
 * rechargement de page — limitation backend, pas un choix frontend (cf. NKS_FRONTEND_AGENT_CONTEXT.md).
 */
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

/** bf.laterrasse.nks.dto.poule.DuoResponse — listable via GET /duos/phase/{phaseId} (contrairement aux poules) */
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
}

export interface Classement {
  id: string;
  candidat: CandidatPublicResponse;
  rangGlobal: number;
  totalPoints: number;
  officiel: boolean;
}

export interface ResultatPhase {
  id: string;
  rang: number;
  pointsVotes: number;
  pointsJury: number;
  pointsPublic: number;
  totalPoints: number;
  statut: StatutQualification;
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
}

export interface Reservation {
  id: string;
  nomReservant: string;
  telephoneReservant: string;
  nbPlaces: number;
  statut: StatutReservation;
  qrCodeUrl?: string;
  qrUuid?: string;
}

export interface ScanResponse {
  resultat: 'VALIDE' | 'INVALIDE' | 'DEJA_UTILISE';
  nomSpectateur: string | null;
  nbPlaces: number | null;
  timestampPremierScan: string | null;
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
