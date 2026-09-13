import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { CandidatService } from '@core/services/candidat.service';
import { messageErreur } from '@core/utils/http-error.util';
import { MonChoixTitre } from '@core/models';

/**
 * Choix, par le candidat, d'un titre imposé (parmi la liste publiée par le CO pour la
 * phase de sa manche à venir) + déclaration d'un titre personnel libre — cf. échange du
 * 13/09/2026 : "chaque candidat devra se connecter à son espace pour choisir le titre de
 * la liste imposé et egalement son titre personnel avant chaque manche".
 *
 * Non bloquant : contrairement au consentement (consentGuard), l'absence de choix
 * n'empêche jamais l'accès au reste de l'espace candidat — seul un bandeau de rappel
 * apparaît sur le tableau de bord (cf. CandidatDashboardComponent).
 */
@Component({
  selector: 'app-mon-titre',
  imports: [ReactiveFormsModule, DatePipe, RouterModule],
  templateUrl: './mon-titre.component.html',
  styleUrls: ['./mon-titre.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MonTitreComponent implements OnInit {
  private candidatSvc = inject(CandidatService);
  private fb = inject(FormBuilder);

  isLoading = true;
  erreur: string | null = null;
  donnees: MonChoixTitre | null = null;

  isSaving = false;
  erreurSauvegarde: string | null = null;
  succes = false;

  form = this.fb.nonNullable.group({
    titreImposeId: ['', Validators.required],
    titrePersonnel: ['', [Validators.required, Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.isLoading = true;
    this.erreur = null;
    this.candidatSvc.monChoixTitre().pipe(
      catchError(err => {
        this.erreur = messageErreur(err, 'Impossible de charger les titres imposés — réessaie.');
        return of(null);
      }),
      finalize(() => { this.isLoading = false; }),
    ).subscribe(res => {
      this.donnees = res;
      if (res?.choixActuel) {
        this.form.patchValue({
          titreImposeId: res.choixActuel.titreImposeId,
          titrePersonnel: res.choixActuel.titrePersonnel,
        });
      }
    });
  }

  get dejaChoisi(): boolean {
    return !!this.donnees?.choixActuel;
  }

  enregistrer(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isSaving) return;

    const v = this.form.getRawValue();
    this.isSaving = true;
    this.erreurSauvegarde = null;
    this.succes = false;

    this.candidatSvc.choisirTitre(v.titreImposeId, v.titrePersonnel.trim()).pipe(
      catchError(err => {
        this.erreurSauvegarde = messageErreur(err, "Impossible d'enregistrer ton choix — réessaie.");
        return of(null);
      }),
      finalize(() => { this.isSaving = false; }),
    ).subscribe(res => {
      if (!res) return;
      this.succes = true;
      if (this.donnees) {
        this.donnees = { ...this.donnees, choixActuel: res };
      }
    });
  }
}
