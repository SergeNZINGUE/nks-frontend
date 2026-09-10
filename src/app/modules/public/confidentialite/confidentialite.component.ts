import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '@shared/components/site-header/site-header.component';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { BottomNavComponent } from '@shared/components/bottom-nav/bottom-nav.component';
import { SiteFooterComponent } from '@shared/components/site-footer/site-footer.component';

/**
 * BROUILLON — décrit les traitements réellement effectués par la plateforme
 * (candidature, vote, paiement LigdiCash, SMS/WhatsApp via HDR Stream, hébergement
 * médias Cloudinary) mais jamais relu par un juriste. Cf. échange du 10/09/2026.
 */
@Component({
  selector: 'app-confidentialite',
  imports: [SiteHeaderComponent, TopbarComponent, BottomNavComponent, SiteFooterComponent, RouterLink],
  template: `
<div class="page legal-page">
  <app-site-header />
  <app-topbar title="Politique de confidentialité" backLink="/" backLabel="Retour à l'accueil" />

  <main class="legal">
    <div class="legal__inner">
      <div class="legal__brouillon" role="note">
        ⚠️ <strong>Document provisoire.</strong> Cette politique décrit les traitements de données réellement
        effectués par la plateforme mais n'a pas encore été relue par un juriste — ne pas la considérer comme
        définitive avant validation par l'organisateur.
      </div>

      <h1>Politique de confidentialité</h1>
      <p class="legal__maj">Dernière mise à jour : à compléter à la validation.</p>

      <h2>1. Responsable du traitement</h2>
      <p>
        <strong>La Terrasse</strong>, Ouagadougou, Burkina Faso, organisateur de la compétition
        Night Karaoke Stars, est responsable du traitement des données décrites ci-dessous.
        [Coordonnées complètes / contact dédié à préciser.]
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li><strong>Candidature</strong> — prénom, nom, date de naissance, téléphone, e-mail, photo, vidéo de présélection, capture d'abonnement réseaux sociaux, chanson choisie, texte de motivation.</li>
        <li><strong>Compte et connexion</strong> — identifiants de connexion, historique de connexion.</li>
        <li><strong>Vote public</strong> — numéro de téléphone du votant (vote en ligne payant), pour la facturation et le contrôle anti-fraude.</li>
        <li><strong>Paiement</strong> — montant, statut, référence de transaction (le numéro de carte/mobile money n'est jamais stocké par la plateforme : le paiement est traité par le prestataire LigdiCash).</li>
        <li><strong>Billetterie</strong> — nom, téléphone du réservataire, pour les soirées événementielles.</li>
        <li><strong>Navigation</strong> — jeton de connexion stocké dans le navigateur (localStorage), nécessaire au fonctionnement du compte ; pas de cookie publicitaire tiers.</li>
      </ul>

      <h2>3. Finalités</h2>
      <ul>
        <li>Gérer les candidatures et l'organisation de la compétition.</li>
        <li>Permettre le vote du public et son décompte.</li>
        <li>Traiter les paiements (inscription, votes, billetterie).</li>
        <li>Communiquer avec les candidat·e·s et le public (SMS, WhatsApp, e-mail) : convocations, résultats, informations pratiques.</li>
        <li>Assurer la sécurité de la plateforme et prévenir la fraude (ex. plafond de votes par numéro de téléphone).</li>
        <li>Promouvoir la compétition (photo/vidéo des candidat·e·s, cf. règlement — droit à l'image).</li>
      </ul>

      <h2>4. Base légale</h2>
      <p>
        Le traitement repose selon les cas sur : l'exécution du contrat (gestion de la candidature et de la
        participation), le consentement (envoi de communications, droit à l'image), et l'intérêt légitime de
        l'Organisateur (sécurité, prévention de la fraude).
      </p>

      <h2>5. Destinataires des données</h2>
      <p>Les données sont partagées avec les prestataires suivants, dans la stricte mesure nécessaire :</p>
      <ul>
        <li><strong>HDR Stream</strong> — relais des SMS et messages WhatsApp (le message WhatsApp est envoyé depuis un numéro professionnel partagé, visible du destinataire comme provenant de « HDR Stream »).</li>
        <li><strong>LigdiCash</strong> — traitement des paiements (Orange Money, Moov Money…).</li>
        <li><strong>Cloudinary</strong> — hébergement des photos et vidéos.</li>
        <li>Le jury et le comité d'organisation, pour l'évaluation des candidatures.</li>
      </ul>
      <p>Aucune donnée n'est vendue à des tiers à des fins commerciales.</p>

      <h2>6. Durée de conservation</h2>
      <p>
        [À préciser avant publication — proposition : données de candidature et de compte conservées pendant
        la durée de l'édition en cours puis 3 ans après la clôture, sauf demande d'effacement anticipée ;
        données de paiement conservées selon les obligations comptables applicables.]
      </p>

      <h2>7. Vos droits</h2>
      <p>
        Conformément à la réglementation applicable en matière de protection des données personnelles, vous
        disposez d'un droit d'accès, de rectification, d'effacement, d'opposition et de portabilité de vos
        données. Pour exercer ces droits, contactez [adresse e-mail / formulaire à définir]. Vous pouvez à tout
        moment demander le retrait de votre photo/vidéo de la promotion de la compétition (cf. règlement,
        article 7).
      </p>

      <h2>8. Sécurité</h2>
      <p>
        L'accès aux données est protégé par authentification (mot de passe, jeton de session) et restreint
        selon le rôle de chaque utilisateur (candidat, jury, organisateur, administrateur). Les mots de passe
        ne sont jamais stockés en clair.
      </p>

      <h2>9. Cookies et stockage local</h2>
      <p>
        La plateforme utilise le stockage local du navigateur (localStorage) pour maintenir votre session
        connectée. Aucun cookie de suivi publicitaire tiers n'est déposé par la plateforme elle-même.
      </p>

      <h2>10. Modification de cette politique</h2>
      <p>
        Cette politique peut être mise à jour ; la date de dernière modification est indiquée en haut de page.
        Les changements substantiels seront communiqués aux candidat·e·s inscrit·e·s.
      </p>

      <h2>11. Contact</h2>
      <p>Pour toute question relative à vos données personnelles : [contact à définir].</p>

      <p class="legal__retour"><a routerLink="/reglement">← Règlement de la compétition</a> · <a routerLink="/">Accueil →</a></p>
    </div>
  </main>

  <app-site-footer />
  <app-bottom-nav />
</div>
`,
  styleUrls: ['../reglement/reglement.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ConfidentialiteComponent {}
