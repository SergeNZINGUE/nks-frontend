import { ApplicationRef, ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { forkJoin, interval, Subscription, switchMap, startWith, catchError, of } from 'rxjs';
import { EditionService } from '@core/services/edition.service';
import { CandidatService } from '@core/services/candidat.service';
import { SoireeService } from '@core/services/soiree.service';
import { ClassementService } from '@core/services/classement.service';
import { Edition, CandidatPublicResponse, SoireeEvent, Classement } from '@core/models';
import { environment } from '@env/environment';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { RouterLink } from '@angular/router';
import { UpperCasePipe, DecimalPipe, DatePipe } from '@angular/common';
import { PartnersStripComponent } from '../../../shared/components/partners-strip/partners-strip.component';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';
import { SiteFooterComponent } from '../../../shared/components/site-footer/site-footer.component';

interface Countdown { jours: number; heures: number; minutes: number; secondes: number; }

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    imports: [
    SiteHeaderComponent,
    RouterLink,
    PartnersStripComponent,
    BottomNavComponent,
    SiteFooterComponent,
    UpperCasePipe,
    DecimalPipe,
    DatePipe
],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class HomeComponent implements OnInit, OnDestroy {
  private editionSvc = inject(EditionService);
  private candidatSvc = inject(CandidatService);
  private soireeSvc = inject(SoireeService);
  private classementSvc = inject(ClassementService);
  private appRef = inject(ApplicationRef);

  edition: Edition | null = null;
  candidats: CandidatPublicResponse[] = [];
  soirees: SoireeEvent[] = [];
  classement: Classement[] = [];
  loading = true;
  countdown: Countdown = { jours: 0, heures: 0, minutes: 0, secondes: 0 };

  /** Une phase a voteActif = true : c'est la seule situation où "Voter" a un sens. */
  voteActif = false;

  /** Ce que compte le décompte — affiché au-dessus, sinon il ne veut rien dire */
  compteARebourdLibelle: string | null = null;
  /** Faux tant qu'aucune échéance future n'existe : le bloc est alors masqué */
  compteARebourdActif = false;

  private subs = new Subscription();

  ngOnInit(): void {
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
        candidats:   this.candidatSvc.galerie(edition.id, 0, 4).pipe(catchError(() => of(null))),
        soirees:     this.soireeSvc.lister(edition.id).pipe(catchError(() => of([] as SoireeEvent[]))),
        classement:  this.classementSvc.global().pipe(catchError(() => of([] as Classement[]))),
        phaseActive: this.editionSvc.phaseActive(edition.id).pipe(catchError(() => of(null))),
      }).subscribe(({ candidats, soirees, classement, phaseActive }) => {
        this.candidats  = candidats?.content ?? [];
        this.soirees    = soirees.slice(0, 2);
        this.classement = classement.slice(0, 5);
        this.voteActif  = phaseActive !== null;
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

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  initiales(c: CandidatPublicResponse): string {
    return this.candidatSvc.initiales(c);
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

    if (!this.voteActif && this.inscriptionsOuvertes && edition.dateFinInscriptions) {
      cible = new Date(edition.dateFinInscriptions).getTime();
      this.compteARebourdLibelle = 'Clôture des candidatures';
    } else if (!this.voteActif && !this.inscriptionsOuvertes
      && edition.dateDebutInscriptions && new Date(edition.dateDebutInscriptions).getTime() > maintenant) {
      cible = new Date(edition.dateDebutInscriptions).getTime();
      this.compteARebourdLibelle = 'Ouverture des candidatures';
    } else {
      const prochaine = soirees
        .filter(s => s.statut !== 'ANNULEE' && new Date(s.dateHeure).getTime() > maintenant)
        .sort((a, b) => new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime())[0];

      if (prochaine) {
        cible = new Date(prochaine.dateHeure).getTime();
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

    this.compteARebourdActif = true;
    this.startCountdown(cible);
  }

  private startCountdown(target: number): void {
    // interval(1000) ne déclenche ni requête HTTP ni événement DOM : sans tick()
    // manuel ici, le countdown se met à jour en mémoire mais l'écran reste figé
    // jusqu'au prochain clic ailleurs sur la page (même bug que documenté dans
    // app.component.ts, cas particulier des timers RxJS/setInterval).
    let sub: Subscription;
    sub = interval(1000).pipe(startWith(0)).subscribe(() => {
      const diff = target - Date.now();
      if (diff <= 0) {
        this.countdown = { jours: 0, heures: 0, minutes: 0, secondes: 0 };
        this.compteARebourdActif = false;   // l'échéance vient de passer
        sub?.unsubscribe();
        this.rearmerApresEcheance();
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
   * Une échéance vient de passer (fin des candidatures, ouverture de la
   * compétition...). L'ancien code laissait simplement le bloc countdown
   * disparaître : plus aucun palier n'était réarmé et `voteActif` — qui vient
   * d'un fetch ponctuel au chargement — ne se remettait jamais à jour tout
   * seul. On revérifie donc l'état réel côté API et on rearme le prochain
   * palier pertinent, sans attendre un rechargement de page.
   */
  private rearmerApresEcheance(): void {
    if (!this.edition) return;
    const edition = this.edition;
    this.editionSvc.phaseActive(edition.id).pipe(catchError(() => of(null))).subscribe(phase => {
      this.voteActif = phase !== null;
      this.armerCompteARebours(edition, this.soirees);
      this.appRef.tick();
    });
  }
}
