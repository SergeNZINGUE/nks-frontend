import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, interval, of } from 'rxjs';
import { catchError, startWith, switchMap, takeWhile } from 'rxjs/operators';

import { PaiementService, StatutPaiementPublic } from '@core/services/paiement.service';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { SiteFooterComponent } from '../../../shared/components/site-footer/site-footer.component';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';

const INTERVALLE_POLL_MS = 3000;
const TENTATIVES_MAX = 40; // ~2 min à 3s d'intervalle — au-delà, le paiement met anormalement longtemps

/**
 * Page de retour LigdiCash — `return_url`/`cancel_url` doivent pointer ici avec
 * `?paiementId=`. Sert les 3 flux payants (inscription/vote/billet) : générique,
 * pas de contexte candidat/phase requis.
 *
 * Ne fait jamais confiance à un paramètre de statut éventuellement présent dans
 * l'URL de retour (falsifiable côté client) — interroge uniquement le statut
 * réel via `PaiementService.statutPublic()`, qui doit lui-même être re-vérifié
 * côté backend contre LigdiCash (jamais le payload webhook seul). Voir doc
 * LigdiCash transmise à Serge.
 */
@Component({
  selector: 'app-paiement-retour',
  imports: [DecimalPipe, NgTemplateOutlet, RouterModule, SiteHeaderComponent, TopbarComponent, SiteFooterComponent, BottomNavComponent],
  template: `
<app-site-header />

<div class="page paiement-retour">
  <app-topbar title="Paiement" icon="💳" backLink="/" backLabel="Retour à l'accueil" />

  <div class="paiement-retour__shell">

    @if (etat === 'verification') {
      <div class="paiement-retour__carte">
        <div class="paiement-retour__spinner" aria-hidden="true">⣾</div>
        <h2>Vérification du paiement…</h2>
        <p class="text-muted">Ne fermez pas cette page. Cela peut prendre jusqu'à une minute.</p>
      </div>
    }

    @if (etat === 'succes' && statut) {
      <div class="paiement-retour__carte paiement-retour__carte--ok">
        <div class="paiement-retour__icone" aria-hidden="true">✅</div>
        <h2>Paiement confirmé</h2>
        <p class="paiement-retour__montant">{{ statut.montant | number:'1.0-0' }} FCFA</p>
        <p class="text-muted">Merci — c'est pris en compte.</p>
        <a routerLink="/" class="btn btn--primary btn--full">Retour à l'accueil</a>
      </div>
    }

    @if (etat === 'echec' && statut) {
      <div class="paiement-retour__carte paiement-retour__carte--err">
        <div class="paiement-retour__icone" aria-hidden="true">⚠️</div>
        <h2>Paiement non abouti</h2>
        <p class="text-muted">{{ statut.motif ?? (statut.statut === 'EXPIRED' ? 'Le délai de paiement a expiré.' : 'Le paiement a été refusé.') }}</p>
        <a routerLink="/" class="btn btn--secondary btn--full">Retour à l'accueil</a>
        <ng-container [ngTemplateOutlet]="recours" />
      </div>
    }

    @if (etat === 'toujours-en-attente') {
      <div class="paiement-retour__carte">
        <div class="paiement-retour__icone" aria-hidden="true">⏳</div>
        <h2>Toujours en attente</h2>
        <p class="text-muted">La confirmation prend plus de temps que prévu. Réessayez dans quelques instants — votre paiement, s'il a bien été effectué, sera pris en compte automatiquement dès sa confirmation.</p>
        <button type="button" class="btn btn--primary btn--full" (click)="relancer()">Vérifier à nouveau</button>
        <ng-container [ngTemplateOutlet]="recours" />
      </div>
    }

    @if (etat === 'erreur') {
      <div class="paiement-retour__carte paiement-retour__carte--err">
        <div class="paiement-retour__icone" aria-hidden="true">🔌</div>
        <h2>Impossible de vérifier ce paiement</h2>
        <p class="text-muted">{{ messageErreur }}</p>
        <a routerLink="/" class="btn btn--secondary btn--full">Retour à l'accueil</a>
      </div>
    }

  </div>

  <app-site-footer />
  <app-bottom-nav />
</div>

<!--
  Recours : affiché sur les deux issues non-heureuses. Sans référence à citer,
  un utilisateur qui vient d'être débité n'a aucun moyen de réclamer.
-->
<ng-template #recours>
  <div class="paiement-retour__recours">
    <p class="paiement-retour__reference">
      Référence à conserver : <strong>{{ referenceCourte }}</strong>
    </p>
    <a [href]="lienSupport" target="_blank" rel="noopener" class="paiement-retour__support">
      Contacter l'assistance NKS
    </a>
  </div>
</ng-template>
`,
  styleUrls: ['./paiement-retour.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PaiementRetourComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private paiementSvc = inject(PaiementService);

  etat: 'verification' | 'succes' | 'echec' | 'toujours-en-attente' | 'erreur' = 'verification';
  statut: StatutPaiementPublic | null = null;
  messageErreur = '';

  /**
   * Numéro d'assistance NKS (Orange Money / WhatsApp), déjà communiqué aux candidats
   * dans le SMS de validation de candidature côté backend — même canal, même numéro.
   */
  private static readonly TEL_SUPPORT = '22606071717';
  readonly lienSupport = `https://wa.me/${PaiementRetourComponent.TEL_SUPPORT}`;

  /** 8 premiers caractères de l'UUID : suffisant pour retrouver le paiement, court à recopier. */
  get referenceCourte(): string {
    return this.paiementId ? this.paiementId.slice(0, 8).toUpperCase() : '—';
  }

  private paiementId = '';
  private sub = new Subscription();

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('paiementId');
    if (!id) {
      this.etat = 'erreur';
      this.messageErreur = "Lien de retour incomplet (paiementId manquant).";
      return;
    }
    this.paiementId = id;
    this.demarrerVerification();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private demarrerVerification(): void {
    this.etat = 'verification';
    let tentative = 0;
    this.sub.unsubscribe();
    this.sub = new Subscription();
    this.sub.add(
      interval(INTERVALLE_POLL_MS).pipe(
        startWith(0),
        switchMap(() => {
          tentative++;
          return this.paiementSvc.statutPublic(this.paiementId).pipe(
            catchError(() => of(null))
          );
        }),
        takeWhile(res => {
          if (!res) return tentative < TENTATIVES_MAX; // erreur réseau ponctuelle : on retente
          return res.statut === 'PENDING' && tentative < TENTATIVES_MAX;
        }, true)
      ).subscribe(res => {
        if (!res) {
          if (tentative >= TENTATIVES_MAX) {
            this.etat = 'erreur';
            this.messageErreur = "Le service de paiement ne répond pas. Réessayez plus tard.";
          }
          return;
        }
        this.statut = res;
        if (res.statut === 'COMPLETED') {
          this.etat = 'succes';
        } else if (res.statut === 'FAILED' || res.statut === 'EXPIRED' || res.statut === 'REFUNDED') {
          this.etat = 'echec';
        } else if (tentative >= TENTATIVES_MAX) {
          this.etat = 'toujours-en-attente';
        }
      })
    );
  }

  relancer(): void {
    this.demarrerVerification();
  }
}
