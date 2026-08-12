import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';

import { RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';

import { PartenaireService } from '@core/services/partenaire.service';
import { Partenaire } from '@core/models';

/**
 * Bandeau partenaires défilant — CdC §5.1 (visibilité des sponsors).
 *
 * Choix de conception :
 * - Bandeau DÉDIÉ sous la bannière, et non en filigrane derrière le hero :
 *   un sponsor doit être lisible, et le hero porte le compte à rebours et
 *   l'appel à l'action principal.
 * - Le défilement se met en pause au survol et au focus clavier, et il est
 *   entièrement désactivé si l'utilisateur a demandé moins d'animations
 *   (prefers-reduced-motion) — le bandeau devient alors une liste défilable.
 * - Logos en niveaux de gris par défaut : évite le conflit chromatique avec
 *   la charte or/noir. Couleur restituée au survol.
 */
@Component({
  selector: 'app-partners-strip',
  imports: [RouterModule],
  templateUrl: './partners-strip.component.html',
  styleUrls: ['./partners-strip.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PartnersStripComponent implements OnInit {
  private partenaireSvc = inject(PartenaireService);

  /** Logo de l'organisateur, affiché en tête de bandeau */
  readonly organisateurLogo = input<string | null>(null);
  readonly organisateurNom = input('La Terrasse');

  partenaires: Partenaire[] = [];
  /**
   * Piste dupliquée pour le défilement sans couture, calculée UNE FOIS.
   * En getter, elle renvoyait une nouvelle référence à chaque cycle de
   * détection de changements — et le compte à rebours en déclenche un par
   * seconde : le @for recréait alors tout le bandeau chaque seconde.
   */
  piste: Partenaire[] = [];
  dureeAnimation = '30s';
  chargement = true;

  /** Identifiants dont le logo n'a pas pu être chargé → repli sur le nom */
  private logosEnEchec = new Set<string>();

  ngOnInit(): void {
    this.partenaireSvc.lister()
      .pipe(catchError(() => of([] as Partenaire[])))
      .subscribe(list => {
        // Un partenaire sans logo reste affiché : son nom sert de signature.
        this.partenaires = list.filter(p => p.statut === 'ACTIF');
        // La seconde copie prend le relais quand la première sort de l'écran
        this.piste = this.partenaires.length ? [...this.partenaires, ...this.partenaires] : [];
        // Durée proportionnelle au nombre de logos : vitesse constante
        this.dureeAnimation = `${Math.max(18, this.partenaires.length * 6)}s`;
        this.chargement = false;
      });
  }

  /** Évite de recréer le DOM du bandeau à chaque détection de changements */
  suivrePiste(index: number, p: Partenaire): string {
    return `${p.id}-${index}`;
  }

  /**
   * Un logo indisponible ne doit pas laisser un trou dans le bandeau :
   * on bascule sur le nom du partenaire, en capitales dorées.
   */
  logoDisponible(p: Partenaire): boolean {
    return !!p.logoUrl && !this.logosEnEchec.has(p.id);
  }



  onLogoManquant(p: Partenaire): void {
    this.logosEnEchec.add(p.id);
  }
}
