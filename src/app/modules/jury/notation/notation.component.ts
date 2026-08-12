import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, forkJoin, catchError, of } from 'rxjs';

import { JuryService, CandidatBrut, NoteJuryBrut, SaisirNotesRequest, CritereNotationResponse } from '@core/services/jury.service';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

/** Structure locale d'un critère (source normale : GET /jury/criteres, cf. jury.service.ts). */
interface CritereLocal {
  id: string;
  nom: string;
  noteMin: number;
  noteMax: number;
  ordre?: number;
}

/**
 * Les 6 critères OFFICIELS du cahier des charges (§3.4 / Table 6, RM-32 à RM-37).
 * Total = 100 points.
 *
 * DERNIER RECOURS uniquement — depuis l'ajout de GET /jury/criteres (09/08/2026), la grille
 * réelle de l'édition est la source d'autorité. Ce repli ne sert plus que si l'édition n'a
 * aucun critère configuré en base (`criteres_notation` vide) ou si le backend est injoignable.
 *
 * Les UUID correspondent aux INSERT de criteres_notation dans nks_seed_data.sql — n'ont aucune
 * chance de correspondre à une édition recréée depuis l'admin sans rejouer ce seed exact.
 */
const CRITERES_CDC: CritereLocal[] = [
  { id: '00000006-0000-0000-0000-000000000001', nom: 'Prononciation et correction phonétique', noteMin: 0, noteMax: 20, ordre: 1 },
  { id: '00000006-0000-0000-0000-000000000002', nom: 'Mémorisation des paroles',               noteMin: 0, noteMax: 20, ordre: 2 },
  { id: '00000006-0000-0000-0000-000000000003', nom: 'Justesse vocale',                        noteMin: 0, noteMax: 20, ordre: 3 },
  { id: '00000006-0000-0000-0000-000000000004', nom: 'Respect du tempo',                       noteMin: 0, noteMax: 20, ordre: 4 },
  { id: '00000006-0000-0000-0000-000000000005', nom: 'Qualité de la voix',                     noteMin: 0, noteMax: 10, ordre: 5 },
  { id: '00000006-0000-0000-0000-000000000006', nom: 'Présence scénique et interprétation',    noteMin: 0, noteMax: 10, ordre: 6 },
];

@Component({
  selector: 'app-notation',
  imports: [ReactiveFormsModule, RouterModule, TopbarComponent],
  template: `
<div class="notation-page">

  <app-topbar title="Notation" icon="✏️" backLink="/jury" backLabel="Retour à l'espace jury" />

  <!-- Skeleton -->
  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement de la grille de notation">
      <div class="sk sk--banner" aria-hidden="true"></div>
      @for (i of [1,2,3,4]; track i) {
        <div class="sk sk--critere" aria-hidden="true"></div>
      }
    </div>
  }

  <!-- Erreur -->
  @if (!isLoading && erreur) {
    <div class="empty-state" role="alert">
      <p>⚠️ {{ erreur }}</p>
      <a routerLink="/jury" class="btn btn--ghost">← Retour</a>
    </div>
  }

  @if (!isLoading && !erreur && form) {
    <!-- Candidat banner -->
    <div class="cand-banner">
      <div class="cand-avatar">{{ initiales }}</div>
      <div class="cand-info">
        <h2>{{ candidatNom }}</h2>
        <span class="code">{{ candidatCode }}</span>
        @if (chanson) {
          <span class="chanson">🎵 {{ chanson }}</span>
        }
      </div>
    </div>
    <!-- Score bar sticky -->
    <div class="score-bar">
      <span class="score-bar__lbl">Score total</span>
      <div class="score-bar__track">
        <div class="score-bar__fill" [style.width.%]="pourcentage"></div>
      </div>
      <span class="score-bar__val">{{ totalPoints }} / {{ totalMax }}</span>
    </div>
    @if (dejaNote) {
      <div class="banner-ok" role="status">✅ Notes déjà soumises — tu peux les modifier.</div>
    }
    @if (erreurSoumission) {
      <div class="banner-err" role="alert">⚠️ {{ erreurSoumission }}</div>
    }
    <!-- Avertissement : grille officielle chargée en repli -->
    @if (criteresFallback) {
      <div class="banner-warn">
        ⚠️ Grille officielle du cahier des charges (§3.4) affichée en repli — aucun critère
        n'a été trouvé pour cette édition en base. Vérifie que <code>criteres_notation</code>
        a bien été rempli pour l'édition en cours avant de soumettre des notes.
      </div>
    }
    <form [formGroup]="form" class="notation-form">
      @for (c of criteres; track c) {
        <div class="critere-card">
          <div class="critere-card__head">
            <label class="critere-card__nom" [attr.for]="'critere-' + c.id">{{ c.nom }}</label>
            <span class="critere-card__val">{{ val(c.id) }} / {{ c.noteMax }}</span>
          </div>
          <input type="range" [formControlName]="'critere_' + c.id"
            [id]="'critere-' + c.id"
            [min]="c.noteMin" [max]="c.noteMax" [step]="1" class="slider"
            [style.--slider-pct]="pourcentageCritere(c) + '%'"
            [attr.aria-label]="c.nom + ', note sur ' + c.noteMax"
            [attr.aria-valuetext]="val(c.id) + ' sur ' + c.noteMax" />
          <div class="ticks">
            <span>{{ c.noteMin }}</span>
            <span>{{ c.noteMax / 2 }}</span>
            <span>{{ c.noteMax }}</span>
          </div>
        </div>
      }
      <div class="actions">
        <button type="button" class="btn btn--ghost" [disabled]="isSubmitting"
        (click)="retour()">Annuler</button>
        <button type="button" class="btn btn--primary" [disabled]="isSubmitting || form.invalid"
          (click)="soumettre()">
          @if (!isSubmitting) {
            <span>✅ Soumettre</span>
          }
          @if (isSubmitting) {
            <span>⏳ Envoi…</span>
          }
        </button>
      </div>
    </form>
  }
</div>
`,
  styleUrls: ['./notation.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class NotationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private jurySvc = inject(JuryService);

  isLoading = true;
  isSubmitting = false;
  criteres: CritereLocal[] = [];
  candidatNom = '';
  candidatCode = '';
  chanson = '';
  initiales = '';
  candidatId = '';
  soireeId = '';
  form!: FormGroup;
  dejaNote = false;
  erreur: string | null = null;
  erreurSoumission: string | null = null;
  /** true si les critères viennent du fallback seed (gap backend) */
  criteresFallback = false;

  private sub = new Subscription();

  ngOnInit(): void {
    this.candidatId = this.route.snapshot.paramMap.get('candidatId') ?? '';
    this.soireeId   = this.route.snapshot.queryParamMap.get('soireeId') ?? '';

    if (!this.candidatId || !this.soireeId) {
      this.isLoading = false;
      this.erreur = 'Paramètres manquants (candidatId ou soireeId).';
      return;
    }

    // Charger candidats de la soirée + mes notes + grille de critères officielle en parallèle
    this.sub.add(
      forkJoin({
        candidats: this.jurySvc.candidatsPourSoiree(this.soireeId).pipe(catchError(() => of([] as CandidatBrut[]))),
        notes:     this.jurySvc.mesNotes(this.soireeId).pipe(catchError(() => of([] as NoteJuryBrut[]))),
        criteres:  this.jurySvc.criteresNotation(this.soireeId).pipe(catchError(() => of([] as CritereNotationResponse[]))),
      }).subscribe(({ candidats, notes, criteres }) => {
        this.isLoading = false;

        // Résoudre les infos du candidat
        const candidat = candidats.find(c => c.id === this.candidatId);
        if (candidat) {
          const prenom = candidat.utilisateur?.prenom ?? '';
          const nom    = candidat.utilisateur?.nom    ?? '';
          this.candidatNom  = prenom || nom ? `${prenom} ${nom}`.trim() : candidat.codeCandidat;
          this.candidatCode = candidat.codeCandidat;
          this.chanson      = candidat.chansonPreselection ?? '';
          this.initiales    = prenom && nom
            ? (prenom[0] + nom[0]).toUpperCase()
            : candidat.codeCandidat.slice(-2).toUpperCase();
        }

        // Source d'autorité : GET /jury/criteres (grille réelle de l'édition, ajouté 09/08/2026).
        if (criteres.length > 0) {
          this.criteres = criteres
            .slice()
            .sort((a, b) => a.ordre - b.ordre)
            .map(c => ({ id: c.id, nom: c.nom, noteMin: c.noteMin, noteMax: c.noteMax, ordre: c.ordre }));
          this.criteresFallback = false;
        } else {
          // Repli 1 : critères déjà présents dans mes notes existantes (toutes soirées confondues).
          const critereMap = new Map<string, CritereLocal>();
          for (const n of notes) {
            if (!critereMap.has(n.critere.id)) {
              critereMap.set(n.critere.id, {
                id:      n.critere.id,
                nom:     n.critere.nom,
                noteMin: n.critere.noteMin,
                noteMax: n.critere.noteMax,
              });
            }
          }
          if (critereMap.size > 0) {
            this.criteres = Array.from(critereMap.values())
              .sort((a, b) => a.noteMax === b.noteMax ? a.nom.localeCompare(b.nom) : b.noteMax - a.noteMax);
            this.criteresFallback = false;
          } else {
            // Repli 2 (dernier recours) : grille officielle du CdC codée en dur.
            // N'arrive plus en fonctionnement normal depuis l'ajout de GET /jury/criteres —
            // seulement si l'édition n'a aucun critère configuré en base (oubli admin) ou
            // si le backend est injoignable.
            this.criteres = [...CRITERES_CDC];
            this.criteresFallback = true;
          }
        }

        // Notes existantes pour CE candidat
        const notesCeCandidat = notes.filter(n => n.candidat.id === this.candidatId);
        this.dejaNote = notesCeCandidat.length > 0;

        // Construire le formulaire
        const controls: Record<string, unknown> = {};
        for (const c of this.criteres) {
          const existing = notesCeCandidat.find(n => n.critere.id === c.id);
          controls[`critere_${c.id}`] = [
            existing?.valeur ?? c.noteMin,
            [Validators.required, Validators.min(c.noteMin), Validators.max(c.noteMax)],
          ];
        }
        this.form = this.fb.group(controls);
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  val(critereId: string): number {
    return Number(this.form?.get(`critere_${critereId}`)?.value ?? 0);
  }

  get totalPoints(): number {
    if (!this.form) return 0;
    return this.criteres.reduce((sum, c) => sum + (this.val(c.id) || 0), 0);
  }
  get totalMax(): number {
    return this.criteres.reduce((sum, c) => sum + c.noteMax, 0);
  }
  get pourcentage(): number {
    return this.totalMax ? Math.round((this.totalPoints / this.totalMax) * 100) : 0;
  }

  /**
   * Remplissage du curseur, en pourcentage. Liée au SCSS via --slider-pct :
   * les couleurs du dégradé restent dans la feuille de style (tokens), et la
   * valeur initiale est correcte au chargement — ce que l'ancien gestionnaire
   * (input) ne faisait pas pour les notes déjà saisies.
   */
  pourcentageCritere(c: CritereLocal): number {
    const etendue = c.noteMax - c.noteMin;
    if (etendue <= 0) return 0;
    return ((this.val(c.id) - c.noteMin) / etendue) * 100;
  }

  retour(): void {
    this.router.navigate(['/jury']);
  }

  soumettre(): void {
    if (!this.form || this.isSubmitting || this.form.invalid) return;
    this.isSubmitting = true;
    this.erreurSoumission = null;

    const req: SaisirNotesRequest = {
      candidatId: this.candidatId,
      soireeId:   this.soireeId,
      notes: this.criteres.map(c => ({
        critereId: c.id,
        valeur:    this.val(c.id),
      })),
    };

    this.sub.add(
      this.jurySvc.saisirNotes(req).pipe(
        catchError(err => {
          this.erreurSoumission = err?.error?.message ?? 'Erreur lors de la soumission.';
          return of(null);
        })
      ).subscribe(res => {
        this.isSubmitting = false;
        if (res !== null) {
          this.router.navigate(['/jury']);
        }
      })
    );
  }
}
