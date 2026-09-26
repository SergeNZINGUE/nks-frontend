import { ApplicationRef, ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { forkJoin, interval, Subscription, switchMap, startWith, catchError, of } from 'rxjs';
import { EditionService } from '@core/services/edition.service';
import { CandidatService } from '@core/services/candidat.service';
import { SoireeService } from '@core/services/soiree.service';
import { ClassementService } from '@core/services/classement.service';
import { PouleDuoService } from '@core/services/poule-duo.service';
import { MediaService } from '@core/services/media.service';
import { MomentEvenementService } from '@core/services/moment-evenement.service';
import { Edition, CandidatPublicResponse, SoireeEvent, Classement, PouleResponse, MomentEvenement } from '@core/models';
import { environment } from '@env/environment';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { RouterLink } from '@angular/router';
import { UpperCasePipe, DecimalPipe, DatePipe } from '@angular/common';
import { PartnersStripComponent } from '../../../shared/components/partners-strip/partners-strip.component';
import { CompetitionGalleryComponent } from '../../../shared/components/competition-gallery/competition-gallery.component';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';
import { SiteFooterComponent } from '../../../shared/components/site-footer/site-footer.component';
import { StarMarkComponent } from '@shared/components/star-mark/star-mark.component';
import { StarFieldComponent } from '@shared/components/star-field/star-field.component';

interface Countdown { jours: number; heures: number; minutes: number; secondes: number; }

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    imports: [
    SiteHeaderComponent,
    RouterLink,
    PartnersStripComponent,
    CompetitionGalleryComponent,
    BottomNavComponent,
    SiteFooterComponent,
    UpperCasePipe,
    DecimalPipe,
    DatePipe,
    StarMarkComponent,
    StarFieldComponent
],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class HomeComponent implements OnInit, OnDestroy {
  private editionSvc = inject(EditionService);
  private candidatSvc = inject(CandidatService);
  private soireeSvc = inject(SoireeService);
  private classementSvc = inject(ClassementService);
  private pouleSvc = inject(PouleDuoService);
  private mediaSvc = inject(MediaService);
  private momentSvc = inject(MomentEvenementService);
  private appRef = inject(ApplicationRef);

  edition: Edition | null = null;
  candidats: CandidatPublicResponse[] = [];
  soirees: SoireeEvent[] = [];
  classement: Classement[] = [];
  moments: MomentEvenement[] = [];
  momentActif = 0;
  videoEnCoursIndex: number | null = null;
  loading = true;
  countdown: Countdown = { jours: 0, heures: 0, minutes: 0, secondes: 0 };

  /** Une phase a voteActif = true : c'est la seule situation où "Voter" a un sens. */
  voteActif = false;

  /** Ce que compte le décompte — affiché au-dessus, sinon il ne veut rien dire */
  compteARebourdLibelle: string | null = null;
  /** Faux tant qu'aucune échéance future n'existe : le bloc est alors masqué */
  compteARebourdActif = false;
  /**
   * Id de la soirée dont le décompte vient d'atteindre 0 — le bloc reste affiché
   * (libellé « … — En cours ») mais sans les chiffres, tant que le sondage
   * périodique (cf. demarrerPollingSoireeEnCours) n'a pas confirmé sa clôture.
   * null hors de ce cas (autres échéances, ou aucune soirée en cours).
   */
  soireeEnCoursId: string | null = null;
  /** Id de la phase active — nécessaire pour retrouver la poule (donc les candidats) de la
   *  soirée en cours (GET /poules/phase/{id} n'existe pas par soirée directement). */
  private phaseActiveId: string | null = null;
  /** Les 4 candidats de la soirée en cours, pour l'animation « scène » du bloc décompte —
   *  vide tant qu'ils n'ont pas été résolus, ou si la soirée n'a pas exactement 4 candidats
   *  affectés (le template retombe alors sur l'égaliseur seul). */
  candidatsSpotlight: CandidatPublicResponse[] = [];
  private photoSpotlightEnErreur = new Set<string>();

  private subs = new Subscription();
  /** Sondage dédié à la soirée en cours — isolé pour pouvoir l'arrêter sans toucher `subs`. */
  private pollSoireeEnCoursSub = new Subscription();

  ngOnInit(): void {
    this.momentSvc.listerPublic(0, 5).pipe(catchError(() => of(null))).subscribe(page => {
      if (!page?.content.length) return;
      this.moments = page.content;
      if (this.moments.length > 1) this.demarrerCarousel();
    });

    // courante() (et non enCours()) : en EN_PREPARATION aucune édition n'est
    // EN_COURS, mais l'accueil doit quand même connaître l'édition à venir
    // pour ne pas afficher un CTA "Voter" hors sol (cf. voteActif ci-dessous).
    this.editionSvc.courante().subscribe(edition => {
      this.edition = edition;
      if (!edition) { this.loading = false; return; }

      // Chaque source est isolée : forkJoin échoue en bloc dès qu'une seule
      // erreur survient. Sans ce catchError par source, un endpoint en panne
      // viderait toute la page d'accueil au lieu de sa seule section.
      forkJoin({
        // Taille 20 (pas 4) : le spotlight/classement affiché plus bas a besoin de
        // pouvoir retrouver le profil (prénom/nom) des candidats les mieux classés,
        // pas seulement des 4 premiers de la pagination galerie.
        candidats:   this.candidatSvc.galerie(edition.id, 0, 20).pipe(catchError(() => of(null))),
        soirees:     this.soireeSvc.lister(edition.id).pipe(catchError(() => of([] as SoireeEvent[]))),
        classement:  this.classementSvc.global().pipe(catchError(() => of([] as Classement[]))),
        phaseActive: this.editionSvc.phaseActive(edition.id).pipe(catchError(() => of(null))),
      }).subscribe(({ candidats, soirees, classement, phaseActive }) => {
        this.candidats  = candidats?.content ?? [];
        // "Soirées à venir" : mêmes critères que le décompte (armerCompteARebours)
        // — non annulée, date future, triée par proximité — sinon une soirée déjà
        // passée peut rester affichée simplement parce qu'elle arrive en tête de
        // la réponse API brute.
        const maintenant = Date.now();
        this.soirees = soirees
          .filter(s => s.statut !== 'ANNULEE' && s.statut !== 'TERMINEE' && new Date(s.dateHeure).getTime() > maintenant)
          .sort((a, b) => new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime())
          .slice(0, 2);
        this.classement = classement.slice(0, 5);
        this.voteActif  = phaseActive !== null;
        this.phaseActiveId = phaseActive?.id ?? null;
        this.loading    = false;
        // Le décompte dépend des soirées : on l'arme une fois celles-ci reçues
        this.armerCompteARebours(edition, soirees);
      });

      // Rafraîchissement du classement toutes les 60 s.
      // Le catchError est DANS le switchMap : placé à l'extérieur, la première
      // erreur réseau terminerait le flux et le rafraîchissement s'arrêterait
      // définitivement. Ici, chaque tentative échoue isolément et la suivante
      // repart normalement.
      const poll = interval(environment.pollIntervalMs).pipe(
        startWith(0),
        switchMap(() => this.classementSvc.global().pipe(catchError(() => of(null)))),
      ).subscribe(c => { if (c) this.classement = c.slice(0, 5); });
      this.subs.add(poll);
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.pollSoireeEnCoursSub.unsubscribe();
  }

  initiales(c: CandidatPublicResponse): string {
    return this.candidatSvc.initiales(c);
  }

  /**
   * Profil complet (prénom/nom/photo) d'une entrée de classement, si le candidat
   * fait partie de la page de galerie chargée en parallèle — sinon `null` : le
   * template retombe alors sur `codeCandidat` seul plutôt que d'inventer un nom.
   */
  profilClasse(item: Classement): CandidatPublicResponse | null {
    return this.candidats.find(c => c.id === item.candidatId) ?? null;
  }

  initialesClassement(item: Classement): string {
    const profil = this.profilClasse(item);
    return profil ? this.initiales(profil) : item.codeCandidat.slice(-2).toUpperCase();
  }

  prochaineSoiree(): SoireeEvent | null {
    return this.soirees.find(s => s.statut === 'PLANIFIEE') ?? null;
  }

  /** N'affiche le CTA « Devenir candidat » que pendant la fenêtre d'inscription de l'édition en cours. */
  get inscriptionsOuvertes(): boolean {
    return this.editionSvc.inscriptionsOuvertes(this.edition);
  }

  /**
   * Choisit l'échéance à décompter — ce qui est pertinent dépend entièrement
   * de la phase réelle de l'édition, pas d'une seule cascade générique :
   *   - hors vote actif, tant que les inscriptions sont ouvertes (préparation
   *     avec candidatures en cours, présélection...), la seule échéance qui
   *     compte pour un visiteur est la clôture des candidatures — "prochaine
   *     soirée" n'a aucun sens ici, aucune soirée de compétition n'est encore
   *     programmable ;
   *   - hors vote actif et avant l'ouverture des inscriptions, on décompte
   *     jusqu'à cette ouverture ;
   *   - une fois une phase de vote active (compétition en cours), on repasse
   *     sur la prochaine soirée, puis à défaut clôture de l'édition.
   * Si tout est passé, le bloc est masqué : un compteur figé sur 00:00:00
   * donne l'impression d'un site cassé.
   */
  private armerCompteARebours(edition: Edition, soirees: SoireeEvent[]): void {
    const maintenant = Date.now();
    let cible: number | null = null;
    // Renseigné uniquement quand la cible est la dateHeure d'une soirée précise :
    // c'est ce qui déclenche le passage à l'état « en cours » + sondage dans
    // startCountdown, plutôt que le rearmerApresEcheance générique.
    let soireeCible: SoireeEvent | null = null;

    if (!this.voteActif && this.inscriptionsOuvertes && edition.dateFinInscriptions) {
      cible = new Date(edition.dateFinInscriptions).getTime();
      this.compteARebourdLibelle = 'Clôture des candidatures';
    } else if (!this.voteActif && !this.inscriptionsOuvertes
      && edition.dateDebutInscriptions && new Date(edition.dateDebutInscriptions).getTime() > maintenant) {
      cible = new Date(edition.dateDebutInscriptions).getTime();
      this.compteARebourdLibelle = 'Ouverture des candidatures';
    } else {
      // Une soirée dont l'heure est déjà passée mais qui n'est ni ANNULEE ni TERMINEE
      // est déjà "en cours" — à détecter ICI, pas seulement via startCountdown(), qui ne
      // capture le passage à zéro QUE si l'onglet est resté ouvert en continu depuis
      // avant. Sans ce contrôle, un premier chargement (ou un rechargement) pendant une
      // soirée réellement en cours ne montrait jamais la scène : la soirée n'était ni
      // "prochaine" (sa date est passée) ni détectée comme en cours par ailleurs.
      const dejaEnCours = soirees
        .filter(s => s.statut !== 'ANNULEE' && s.statut !== 'TERMINEE' && new Date(s.dateHeure).getTime() <= maintenant)
        .sort((a, b) => new Date(b.dateHeure).getTime() - new Date(a.dateHeure).getTime())[0];

      if (dejaEnCours) {
        this.compteARebourdActif = true;
        this.passerEnCoursPourSoiree(dejaEnCours);
        return;
      }

      // Bug corrigé : une soirée déjà TERMINEE mais dont la dateHeure reste dans le futur
      // (cas réel : statut changé manuellement avant l'heure prévue) passait ce filtre —
      // seule ANNULEE était exclue. Même exclusion que le filtre d'affichage plus bas.
      const prochaine = soirees
        .filter(s => s.statut !== 'ANNULEE' && s.statut !== 'TERMINEE' && new Date(s.dateHeure).getTime() > maintenant)
        .sort((a, b) => new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime())[0];

      if (prochaine) {
        cible = new Date(prochaine.dateHeure).getTime();
        soireeCible = prochaine;
        this.compteARebourdLibelle = `Prochaine soirée — ${prochaine.nom}`;
      } else if (new Date(edition.dateDebutCompetition).getTime() > maintenant) {
        cible = new Date(edition.dateDebutCompetition).getTime();
        this.compteARebourdLibelle = 'Ouverture de la compétition';
      } else if (new Date(edition.dateFinCompetition).getTime() > maintenant) {
        cible = new Date(edition.dateFinCompetition).getTime();
        this.compteARebourdLibelle = 'Clôture de l\'édition';
      }
    }

    if (cible === null) {
      this.compteARebourdActif = false;
      return;
    }

    this.soireeEnCoursId = null;
    this.candidatsSpotlight = [];
    this.compteARebourdActif = true;
    this.startCountdown(cible, soireeCible);
  }

  private startCountdown(target: number, soireeCible: SoireeEvent | null = null): void {
    // interval(1000) ne déclenche ni requête HTTP ni événement DOM : sans tick()
    // manuel ici, le countdown se met à jour en mémoire mais l'écran reste figé
    // jusqu'au prochain clic ailleurs sur la page (même bug que documenté dans
    // app.component.ts, cas particulier des timers RxJS/setInterval).
    let sub: Subscription;
    sub = interval(1000).pipe(startWith(0)).subscribe(() => {
      const diff = target - Date.now();
      if (diff <= 0) {
        this.countdown = { jours: 0, heures: 0, minutes: 0, secondes: 0 };
        sub?.unsubscribe();
        if (soireeCible) {
          // La cible était la dateHeure d'une soirée précise : elle vient
          // probablement de démarrer, pas forcément de se terminer — on
          // affiche « en cours » et on sonde le serveur plutôt que de
          // rearmer aveuglément sur les données déjà en cache.
          this.passerEnCoursPourSoiree(soireeCible);
        } else {
          this.compteARebourdActif = false;   // l'échéance vient de passer
          this.rearmerApresEcheance();
        }
        return;
      }
      this.countdown = {
        jours:    Math.floor(diff / 86_400_000),
        heures:   Math.floor((diff % 86_400_000) / 3_600_000),
        minutes:  Math.floor((diff % 3_600_000)  / 60_000),
        secondes: Math.floor((diff % 60_000)      / 1_000),
      };
      this.appRef.tick();
    });
    this.subs.add(sub);
  }

  /**
   * La soirée décomptée vient d'atteindre sa dateHeure : le bloc reste affiché
   * (libellé « <nom> — En cours », chiffres masqués côté template) le temps
   * qu'un sondage périodique confirme sa clôture réelle côté serveur.
   */
  private passerEnCoursPourSoiree(soiree: SoireeEvent): void {
    this.soireeEnCoursId = soiree.id;
    this.compteARebourdLibelle = `${soiree.nom} — En cours`;
    this.candidatsSpotlight = [];
    this.chargerCandidatsSpotlight(soiree.id);
    this.demarrerPollingSoireeEnCours(soiree.id);
  }

  /**
   * Résout les candidats affectés à la soirée en cours, pour l'animation « scène » du bloc
   * décompte — même chemin de données que classement-poules.component.ts (poules de la phase
   * active, filtrées par soireeId, candidats de la poule trouvée), puisqu'il n'existe pas de
   * route publique "candidats par soirée" directe. Best-effort : n'importe quel échec laisse
   * simplement `candidatsSpotlight` vide, le template retombe alors sur l'égaliseur seul.
   *
   * Nombre de candidats volontairement non figé à 4 : une demi-finale peut en réunir plus
   * ou moins selon les qualifications. `SPOTLIGHT_MAX` protège juste la mise en page contre
   * une poule anormalement chargée ; en-dessous de `SPOTLIGHT_MIN`, la "scène" perd son sens
   * et le template retombe sur l'égaliseur seul.
   */
  private static readonly SPOTLIGHT_MIN = 2;
  private static readonly SPOTLIGHT_MAX = 8;

  private chargerCandidatsSpotlight(soireeId: string): void {
    if (!this.phaseActiveId) return;
    const phaseId = this.phaseActiveId;
    this.pouleSvc.poulesPhase(phaseId).pipe(catchError(() => of([] as PouleResponse[]))).subscribe(poules => {
      const poule = poules.find(p => p.soireeId === soireeId);
      if (!poule) return;
      this.pouleSvc.candidatsPoule(poule.id).pipe(catchError(() => of([]))).subscribe(affectations => {
        const candidats = affectations.map(a => a.candidat).slice(0, HomeComponent.SPOTLIGHT_MAX);
        if (candidats.length < HomeComponent.SPOTLIGHT_MIN) return;
        this.candidatsSpotlight = candidats;
        this.chargerPhotosSpotlight(candidats);
      });
    });
  }

  private chargerPhotosSpotlight(candidats: CandidatPublicResponse[]): void {
    forkJoin(
      candidats.map(c => this.mediaSvc.mediasCandidat(c.id).pipe(catchError(() => of([]))))
    ).subscribe(mediasParCandidat => {
      mediasParCandidat.forEach((medias, i) => candidats[i].photoUrl = this.mediaSvc.photoProfilUrl(medias));
      this.appRef.tick();
    });
  }

  photoSpotlightValide(c: CandidatPublicResponse): boolean {
    return !!c.photoUrl && !this.photoSpotlightEnErreur.has(c.id);
  }

  onPhotoSpotlightErreur(candidatId: string): void {
    this.photoSpotlightEnErreur.add(candidatId);
  }

  /**
   * Sondage dédié, même pattern que classement-poules.component.ts
   * (interval + startWith(0) + switchMap, erreurs absorbées par tentative) :
   * réinterroge la liste des soirées jusqu'à ce que CETTE soirée précise
   * (par id) passe TERMINEE ou ait ses résultats publiés, puis rearme le
   * décompte sur les données fraîches — sans que l'utilisateur recharge.
   */
  private demarrerPollingSoireeEnCours(soireeId: string): void {
    this.pollSoireeEnCoursSub.unsubscribe();
    this.pollSoireeEnCoursSub = new Subscription();
    if (!this.edition) return;
    const edition = this.edition;

    const poll = interval(environment.pollIntervalMs).pipe(
      startWith(0),
      switchMap(() => this.soireeSvc.lister(edition.id).pipe(catchError(() => of([] as SoireeEvent[])))),
    ).subscribe(soirees => {
      const cible = soirees.find(s => s.id === soireeId);
      const cloturee = !!cible && (cible.statut === 'TERMINEE' || cible.resultatsPublies);
      if (!cloturee) return;

      this.pollSoireeEnCoursSub.unsubscribe();
      this.pollSoireeEnCoursSub = new Subscription();

      // Même filtre que le chargement initial (cf. ngOnInit) : la carte
      // "Soirées à venir" ne doit pas continuer d'afficher une soirée qui
      // vient de se terminer, sans attendre un rechargement de page.
      const maintenant = Date.now();
      this.soirees = soirees
        .filter(s => s.statut !== 'ANNULEE' && s.statut !== 'TERMINEE' && new Date(s.dateHeure).getTime() > maintenant)
        .sort((a, b) => new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime())
        .slice(0, 2);

      this.soireeEnCoursId = null;
      this.candidatsSpotlight = [];
      this.rearmerApresEcheance(soirees);
      this.appRef.tick();
    });
    this.pollSoireeEnCoursSub.add(poll);
  }

  /**
   * Une échéance vient de passer (fin des candidatures, ouverture de la
   * compétition...). L'ancien code laissait simplement le bloc countdown
   * disparaître : plus aucun palier n'était réarmé et `voteActif` — qui vient
   * d'un fetch ponctuel au chargement — ne se remettait jamais à jour tout
   * seul. On revérifie donc l'état réel côté API et on rearme le prochain
   * palier pertinent, sans attendre un rechargement de page.
   */
  private rearmerApresEcheance(soireesFraiches?: SoireeEvent[]): void {
    if (!this.edition) return;
    const edition = this.edition;
    this.editionSvc.phaseActive(edition.id).pipe(catchError(() => of(null))).subscribe(phase => {
      this.voteActif = phase !== null;
      this.phaseActiveId = phase?.id ?? null;
      this.armerCompteARebours(edition, soireesFraiches ?? this.soirees);
      this.appRef.tick();
    });
  }

  creditMoment(m: MomentEvenement): string {
    return this.momentSvc.credit(m);
  }

  prochainMoment(): void {
    this.momentActif = (this.momentActif + 1) % this.moments.length;
    this.videoEnCoursIndex = null;
  }

  precedentMoment(): void {
    this.momentActif = (this.momentActif - 1 + this.moments.length) % this.moments.length;
    this.videoEnCoursIndex = null;
  }

  allerAuMoment(i: number): void {
    this.momentActif = i;
    this.videoEnCoursIndex = null;
  }

  private demarrerCarousel(): void {
    const sub = interval(5000).subscribe(() => {
      this.momentActif = (this.momentActif + 1) % this.moments.length;
      this.videoEnCoursIndex = null;
      this.appRef.tick();
    });
    this.subs.add(sub);
  }
}
