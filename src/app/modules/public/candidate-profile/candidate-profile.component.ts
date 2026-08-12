import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CandidatService } from '@core/services/candidat.service';
import { VoteService } from '@core/services/vote.service';
import { EditionService } from '@core/services/edition.service';
import { MediaService } from '@core/services/media.service';
import { CandidatPublicResponse, ResultatPhase, VoteCompteur } from '@core/models';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { DecimalPipe } from '@angular/common';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';

@Component({
    selector: 'app-candidate-profile',
    templateUrl: './candidate-profile.component.html',
    styleUrls: ['./candidate-profile.component.scss'],
    imports: [
    SiteHeaderComponent,
    TopbarComponent,
    RouterLink,
    BottomNavComponent,
    DecimalPipe
],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class CandidateProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private candidatSvc = inject(CandidatService);
  private voteSvc = inject(VoteService);
  private editionSvc = inject(EditionService);
  private mediaSvc = inject(MediaService);

  candidat: CandidatPublicResponse | null = null;
  scores: ResultatPhase[] = [];
  votes: VoteCompteur | null = null;
  loading = true;
  error: string | null = null;
  phaseActiveId: string | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    forkJoin({
      candidat: this.candidatSvc.profil(id),
      scores:   this.candidatSvc.scores(id),
    }).subscribe({
      next: ({ candidat, scores }) => {
        this.candidat = candidat;
        this.scores   = scores;
        this.loading  = false;
        this.chargerVotes(id);
        this.chargerPhoto(id);
      },
      error: () => {
        this.error   = 'Candidat introuvable.';
        this.loading = false;
      },
    });
  }

  private chargerPhoto(candidatId: string): void {
    this.mediaSvc.mediasCandidat(candidatId).subscribe({
      next: medias => { if (this.candidat) this.candidat.photoUrl = this.mediaSvc.photoProfilUrl(medias); },
      error: () => { /* pas de photo : fallback initiales déjà géré par le template */ },
    });
  }

  private chargerVotes(candidatId: string): void {
    this.editionSvc.enCours().subscribe(edition => {
      if (!edition) return;
      this.editionSvc.phaseActive(edition.id).subscribe(phase => {
        if (!phase) return;
        this.phaseActiveId = phase.id;
        this.voteSvc.compteur(candidatId, phase.id).subscribe(v => { this.votes = v; });
      });
    });
  }

  initiales(): string {
    return this.candidat ? this.candidatSvc.initiales(this.candidat) : '';
  }

  statutLabel(statut: string): string {
    const map: Record<string, string> = {
      QUALIFIE: 'Qualifié ✓', ELIMINE: 'Éliminé ✗',
      REPECHAGE: 'Repêché ↑', EN_ATTENTE: 'En attente…',
    };
    return map[statut] ?? statut;
  }

  phaseLabel(res: ResultatPhase): string {
    // Les résultats de phase n'exposent pas directement le nom de phase — affichage générique
    return `Phase — ${res.totalPoints} pts`;
  }
}
