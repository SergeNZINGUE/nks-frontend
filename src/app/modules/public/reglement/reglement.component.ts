import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '@shared/components/site-header/site-header.component';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { BottomNavComponent } from '@shared/components/bottom-nav/bottom-nav.component';
import { SiteFooterComponent } from '@shared/components/site-footer/site-footer.component';

/**
 * BROUILLON — rédigé à partir du fonctionnement réel du produit (phases, pondérations,
 * vote payant/gratuit, âge minimum 18 ans côté backend) mais jamais relu par un juriste.
 * Ne pas considérer comme opposable avant validation. Cf. échange du 10/09/2026 : demandé
 * dans le cadre de la mise en conformité RGPD — consentement au règlement + à la politique
 * de confidentialité (reglement.component.ts) avant toute candidature.
 */
@Component({
  selector: 'app-reglement',
  imports: [SiteHeaderComponent, TopbarComponent, BottomNavComponent, SiteFooterComponent, RouterLink],
  template: `
<div class="page legal-page">
  <app-site-header />
  <app-topbar title="Règlement" backLink="/" backLabel="Retour à l'accueil" />

  <main class="legal">
    <div class="legal__inner">
      <div class="legal__brouillon" role="note">
        ⚠️ <strong>Document provisoire.</strong> Ce règlement décrit le fonctionnement réel de la compétition
        mais n'a pas encore été relu par un juriste — ne pas le considérer comme définitif avant validation
        par l'organisateur.
      </div>

      <h1>Règlement de la compétition — Night Karaoke Stars</h1>
      <p class="legal__maj">Dernière mise à jour : à compléter à la validation.</p>

      <h2>Article 1 — Organisateur</h2>
      <p>
        La compétition <strong>Night Karaoke Stars</strong> (« NKS ») est organisée par
        <strong>La Terrasse</strong>, Ouagadougou, Burkina Faso (« l'Organisateur »).
        [Forme juridique / numéro de registre du commerce à compléter.]
      </p>

      <h2>Article 2 — Conditions de participation</h2>
      <ul>
        <li>Être âgé·e d'au moins 18 ans à la date d'inscription.</li>
        <li>Fournir des informations d'identité exactes (nom, prénom, date de naissance, téléphone, e-mail).</li>
        <li>Fournir une photo (JPG/PNG, 5 Mo max) et une vidéo de présélection (MP4, 45 à 60 secondes, 100 Mo max).</li>
        <li>Justifier d'un abonnement aux pages officielles NKS (Facebook / TikTok) par capture d'écran.</li>
        <li>S'acquitter des frais d'inscription (article 4) une fois la candidature validée par l'Organisateur.</li>
      </ul>

      <h2>Article 3 — Déroulement de l'inscription</h2>
      <p>
        La candidature est soumise en ligne. Elle est ensuite examinée par le comité d'organisation, qui
        peut la valider ou la rejeter (avec motif). En cas de validation, un compte candidat est créé et les
        identifiants de connexion sont transmis par SMS et/ou e-mail. Les frais d'inscription sont réglés
        <strong>après</strong> validation, depuis l'espace personnel du candidat.
      </p>

      <h2>Article 4 — Frais d'inscription</h2>
      <p>
        Les frais d'inscription s'élèvent à <strong>15 000 FCFA</strong> [montant configurable côté plateforme —
        à confirmer], réglables par Orange Money, Moov Money ou tout autre moyen proposé sur la plateforme de
        paiement. Ce montant n'est pas remboursable, sauf décision contraire de l'Organisateur. [Politique de
        remboursement à préciser : désistement, annulation de la compétition, etc.]
      </p>

      <h2>Article 5 — Phases de la compétition</h2>
      <p>La compétition se déroule en phases successives :</p>
      <ol>
        <li><strong>Présélection</strong> — examen des candidatures (vidéo, dossier), pas de vote à ce stade.</li>
        <li><strong>Éliminatoires</strong> — passages individuels, notés selon les critères de l'article 6.</li>
        <li><strong>Demi-finale</strong> — les candidats retenus sont répartis en duos ou poules.</li>
        <li><strong>Finale</strong> — désignation du ou de la gagnant·e.</li>
      </ol>
      <p>
        L'Organisateur se réserve le droit d'ajuster le nombre et l'ordre des phases selon le nombre
        de candidatures reçues.
      </p>

      <h2>Article 6 — Notation et classement</h2>
      <p>Le score de chaque candidat·e, par phase, combine trois composantes pondérées :</p>
      <ul>
        <li><strong>Vote en ligne payant</strong> — le public vote via la plateforme (100 FCFA/vote [à confirmer]), plafonné pour limiter les abus (contrôle anti-fraude par numéro de téléphone).</li>
        <li><strong>Vote du public sur place</strong> — lors des soirées événementielles, dans les salles partenaires.</li>
        <li><strong>Notation du jury</strong> — un jury désigné par l'Organisateur note chaque prestation selon des critères définis en interne.</li>
      </ul>
      <p>
        La pondération exacte de chaque composante est fixée par phase et communiquée avant chaque manche.
        Un·e candidat·e éliminé·e peut être repêché·e à la discrétion du comité d'organisation, sur motif écrit.
      </p>

      <h2>Article 7 — Droit à l'image</h2>
      <p>
        En s'inscrivant, le·la candidat·e autorise l'Organisateur à utiliser sa photo, sa vidéo de présélection
        et les images/vidéos captées durant les soirées événementielles, à des fins de promotion de la
        compétition (site web, réseaux sociaux, supports de communication), pour la durée de la compétition et
        [durée post-compétition à préciser]. Cette autorisation est gratuite et vaut pour tous les supports,
        sauf demande écrite de retrait adressée à l'Organisateur (cf. politique de confidentialité pour les
        modalités).
      </p>

      <h2>Article 8 — Disqualification</h2>
      <p>
        L'Organisateur peut disqualifier un·e candidat·e à tout moment en cas de fraude (manipulation des
        votes, fausses informations, contenu inapproprié), de comportement contraire à l'esprit de la
        compétition, ou de non-respect du présent règlement.
      </p>

      <h2>Article 9 — Récompenses</h2>
      <p>[Nature et valeur des prix à préciser avant publication.]</p>

      <h2>Article 10 — Responsabilité</h2>
      <p>
        L'Organisateur ne saurait être tenu responsable des interruptions techniques (plateforme, paiement,
        réseau) indépendantes de sa volonté. La participation implique l'acceptation sans réserve du présent
        règlement.
      </p>

      <h2>Article 11 — Modification du règlement</h2>
      <p>
        L'Organisateur se réserve le droit de modifier le présent règlement à tout moment ; les candidat·e·s
        déjà inscrit·e·s en seront informé·e·s par e-mail ou SMS.
      </p>

      <h2>Article 12 — Droit applicable</h2>
      <p>
        Le présent règlement est soumis au droit burkinabè. Tout litige relève de la compétence des
        juridictions de Ouagadougou.
      </p>

      <p class="legal__retour"><a routerLink="/">← Retour à l'accueil</a> · <a routerLink="/confidentialite">Politique de confidentialité →</a></p>
    </div>
  </main>

  <app-site-footer />
  <app-bottom-nav />
</div>
`,
  styleUrls: ['./reglement.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ReglementComponent {}
