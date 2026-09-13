import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { GrilleDeliberationResponse, NoteParJuryResponse } from '@core/services/jury.service';
import { ModalComponent } from '../../../modules/admin/shared/ui/modal/modal.component';

const LABEL_PHASE: Record<string, string> = {
  PRESELECTION:  'Présélection',
  ELIMINATOIRES: 'Éliminatoires',
  DEMI_FINALE:   'Demi-finale',
  FINALE:        'Finale',
};

/**
 * Grille récapitulative de délibération (jury + votes en ligne + vote public), partagée entre
 * l'écran admin (admin/jury) et l'espace jury (modules/jury) — même donnée
 * (GrilleDeliberationResponse), même présentation, un seul bouton "Télécharger" (impression
 * navigateur → "Enregistrer en PDF", pas de génération PDF côté client pour éviter une
 * dépendance supplémentaire).
 */
@Component({
  selector: 'app-grille-deliberation',
  imports: [ModalComponent, DecimalPipe, DatePipe],
  template: `
<app-modal [titre]="'Délibération — ' + grille().soireeNom" (fermer)="fermer.emit()">
  <div class="gd-entete">
    <span><strong>Manche :</strong> {{ grille().soireeNom }}</span>
    <span><strong>Date :</strong> {{ grille().soireeDateHeure | date:'EEEE d MMMM yyyy, HH:mm' }}</span>
    <span><strong>Phase :</strong> {{ labelPhase(grille().phaseNom) }}</span>
    <span>
      <strong>Notation :</strong>
      <span class="gd-badge" [class.gd-badge--cloture]="grille().notationCloturee">
        {{ grille().notationCloturee ? 'Clôturée' : 'En cours' }}
      </span>
    </span>
  </div>

  <p class="field-hint">
    Notes jury spécifiques à cette soirée. Vote public sur place : spécifique à cette soirée
    également. Votes en ligne (payants + sociaux) : cumulés sur toute la phase.
  </p>

  <div class="form__actions" style="margin-bottom: 12px;">
    <button type="button" class="btn btn--ghost" (click)="telecharger()">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Télécharger
    </button>
  </div>

  @if (grille().candidats.length === 0) {
    <div class="empty-state">Aucun candidat rattaché à cette soirée (poules/duos non affectés).</div>
  }

  @for (ligne of grille().candidats; track ligne.candidatId; let i = $index) {
    <div class="deliberation-ligne">
      <div class="deliberation-ligne__header" (click)="toggleDetail(ligne.candidatId)">
        <span class="deliberation-ligne__rang">#{{ i + 1 }}</span>
        <span class="deliberation-ligne__nom">{{ ligne.prenom }} {{ ligne.nom }} <small>({{ ligne.codeCandidat }})</small></span>
        <span class="deliberation-ligne__total">Total : <strong>{{ ligne.totalGeneral | number:'1.2-2' }}</strong></span>
      </div>
      <div class="deliberation-ligne__resume">
        <span>Jury : {{ ligne.pointsJury | number:'1.2-2' }} <small>(moyenne brute {{ ligne.totalJuryMoyen | number:'1.2-2' }}, {{ ligne.notesParJury.length }} juré(s))</small></span>
        <span>Votes en ligne : {{ ligne.pointsVotesEnLigne | number:'1.2-2' }} <small>({{ ligne.votesPayants }} payants, {{ ligne.votesLikes }} likes, {{ ligne.votesCommentaires }} commentaires — cumul phase)</small></span>
        <span>Vote public : {{ ligne.pointsPublicSurPlace | number:'1.2-2' }} <small>({{ ligne.votesPublicSurPlace }} voix — cette soirée)</small></span>
      </div>
      @if (candidatDetailOuvert() === ligne.candidatId) {
        @if (ligne.notesParJury.length === 0) {
          <p class="field-hint">Aucune note de jury saisie pour ce candidat sur cette soirée.</p>
        } @else {
          <table class="tbl" style="margin-top: 8px;">
            <thead>
              <tr>
                <th>Juré</th>
                @for (c of grille().criteres; track c.id) { <th>{{ c.nom }} <small>/ {{ c.noteMax }}</small></th> }
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              @for (nj of ligne.notesParJury; track nj.juryId) {
                <tr>
                  <td>{{ nj.juryNomComplet }}</td>
                  @for (c of grille().criteres; track c.id) {
                    <td>{{ valeurCritere(nj, c.id) }}</td>
                  }
                  <td><strong>{{ nj.totalJury | number:'1.2-2' }}</strong></td>
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </div>
  }
</app-modal>
`,
  styles: [`
    .gd-entete { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 10px; font-size: 14px; }
    .gd-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 600; font-size: 12px; background: rgba(230,180,60,0.15); color: #e6b43c; border: 1px solid rgba(230,180,60,0.3); }
    .gd-badge--cloture { background: rgba(200,60,60,0.15); color: #d9534f; border-color: rgba(200,60,60,0.3); }
    .deliberation-ligne { border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; }
    .deliberation-ligne__header { display: flex; align-items: center; gap: 10px; cursor: pointer; flex-wrap: wrap; }
    .deliberation-ligne__rang { font-weight: 700; opacity: 0.6; }
    .deliberation-ligne__nom { flex: 1; font-weight: 600; }
    .deliberation-ligne__resume { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; font-size: 13px; opacity: 0.85; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrilleDeliberationComponent {
  grille = input.required<GrilleDeliberationResponse>();
  fermer = output<void>();

  candidatDetailOuvert = signal<string | null>(null);

  labelPhase(n: string): string { return LABEL_PHASE[n] ?? n; }

  toggleDetail(candidatId: string): void {
    this.candidatDetailOuvert.set(this.candidatDetailOuvert() === candidatId ? null : candidatId);
  }

  valeurCritere(nj: NoteParJuryResponse, critereId: string): string {
    const d = nj.details.find(x => x.critereId === critereId);
    return d ? String(d.valeur) : '—';
  }

  /** Ouvre un onglet avec une version imprimable et déclenche l'impression navigateur ("Enregistrer en PDF"). */
  telecharger(): void {
    const g = this.grille();
    const w = window.open('', '_blank');
    if (!w) return;

    const date = new Date(g.soireeDateHeure).toLocaleString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const statut = g.notationCloturee ? 'Clôturée' : 'En cours';

    const lignesHtml = g.candidats.map((ligne, i) => {
      const detailJury = ligne.notesParJury.length === 0
        ? '<p><em>Aucune note de jury saisie.</em></p>'
        : `<table>
            <thead><tr><th>Juré</th>${g.criteres.map(c => `<th>${c.nom} (/${c.noteMax})</th>`).join('')}<th>Total</th></tr></thead>
            <tbody>
              ${ligne.notesParJury.map(nj => `
                <tr>
                  <td>${nj.juryNomComplet}</td>
                  ${g.criteres.map(c => {
                    const d = nj.details.find(x => x.critereId === c.id);
                    return `<td>${d ? d.valeur : '—'}</td>`;
                  }).join('')}
                  <td><strong>${nj.totalJury.toFixed(2)}</strong></td>
                </tr>`).join('')}
            </tbody>
          </table>`;

      return `
        <div class="ligne">
          <h3>#${i + 1} — ${ligne.prenom} ${ligne.nom} (${ligne.codeCandidat}) — Total : ${ligne.totalGeneral.toFixed(2)}</h3>
          <p>
            Jury : ${ligne.pointsJury.toFixed(2)} (moyenne brute ${ligne.totalJuryMoyen.toFixed(2)}, ${ligne.notesParJury.length} juré(s)) —
            Votes en ligne : ${ligne.pointsVotesEnLigne.toFixed(2)} (${ligne.votesPayants} payants, ${ligne.votesLikes} likes, ${ligne.votesCommentaires} commentaires, cumul phase) —
            Vote public : ${ligne.pointsPublicSurPlace.toFixed(2)} (${ligne.votesPublicSurPlace} voix, cette soirée)
          </p>
          ${detailJury}
        </div>`;
    }).join('<hr/>');

    w.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Grille de délibération — ${g.soireeNom}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .entete { margin-bottom: 20px; font-size: 14px; }
          .entete span { display: inline-block; margin-right: 24px; }
          table { border-collapse: collapse; width: 100%; margin: 8px 0 16px; font-size: 12px; }
          th, td { border: 1px solid #999; padding: 4px 8px; text-align: left; }
          th { background: #eee; }
          hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
          .ligne h3 { margin-bottom: 4px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Grille de délibération — ${g.soireeNom}</h1>
        <div class="entete">
          <span><strong>Manche :</strong> ${g.soireeNom}</span>
          <span><strong>Date :</strong> ${date}</span>
          <span><strong>Phase :</strong> ${this.labelPhase(g.phaseNom)}</span>
          <span><strong>Statut de la notation :</strong> ${statut}</span>
        </div>
        ${lignesHtml || '<p>Aucun candidat rattaché à cette soirée.</p>'}
      </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }
}
