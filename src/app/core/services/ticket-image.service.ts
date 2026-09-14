import { Injectable } from '@angular/core';

/**
 * Données nécessaires à la composition d'un visuel de billet (un par billet
 * physique — un qrUuid). Le QR code est déjà généré par l'appelant (QRCode.toDataURL,
 * cf. tickets.component/reservation.component) : ce service ne fait QUE composer
 * l'image finale, il ne génère et ne transmet jamais le qrUuid lui-même.
 */
export interface DonneesBilletImage {
  soireeNom: string;
  /** ISO 8601 — SoireeEvent.dateHeure */
  soireeDateHeure: string;
  soireeLieu?: string | null;
  nomSpectateur: string;
  categorieNom?: string | null;
  /** Data URL déjà produit par QRCode.toDataURL(`NKS:${qrUuid}`) — jamais régénéré ici. */
  qrDataUrl: string;
  /** Ex. "1/3" si la réservation compte plusieurs billets — omis si un seul billet. */
  numeroBillet?: string | null;
}

const LARGEUR = 480;
const HAUTEUR = 800;

// Palette NKS (_tokens.scss) — pas la palette FESPACO (rouge/jaune) de la référence
// visuelle, seule la STRUCTURE de mise en page (visuel haut / bande diagonale QR /
// bandeau bas) est reprise.
const NKS_BG_PRIMARY = '#0D0D1E';
const NKS_BG_SURFACE = '#1A1A2E';
const NKS_GOLD = '#C9A227';
const NKS_GOLD_LIGHT = '#E8C04A';
const NKS_TEXT = '#FFFFFF';
const NKS_TEXT_SECONDARY = '#C8C8D0';

/**
 * Génère et déclenche le téléchargement d'une image de billet façon "badge événement"
 * (référence client : billet FESPACO — visuel haut, bande diagonale QR+catégorie,
 * bandeau bas branding+dates — adapté à la charte NKS noir/or).
 *
 * 100% côté navigateur (Canvas 2D) : cohérent avec le reste de la billetterie où le QR
 * n'est déjà généré QUE côté client (jamais transmis au serveur), pour ne jamais faire
 * transiter le qrUuid — secret d'entrée/de vote — par un tiers. Aucune dépendance ajoutée.
 */
@Injectable({ providedIn: 'root' })
export class TicketImageService {
  private cacheLogos = new Map<string, Promise<HTMLImageElement>>();

  /** Compose le billet sur un canvas hors-DOM et renvoie un data URL PNG (canvas.toDataURL). */
  async genererImageBillet(donnees: DonneesBilletImage): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = LARGEUR;
    canvas.height = HAUTEUR;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponible');

    const [logoNks, logoTerrasse, qrImg] = await Promise.all([
      this.chargerImage('assets/logos/nks.png'),
      this.chargerImage('assets/logos/la-terrasse.png'),
      this.chargerImage(donnees.qrDataUrl),
    ]);

    // ── Fond général ──
    ctx.fillStyle = NKS_BG_PRIMARY;
    ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

    // ── Zone visuelle haute : dégradé + logo NKS + nom/date de la soirée ──
    const gradHaut = ctx.createLinearGradient(0, 0, 0, 420);
    gradHaut.addColorStop(0, NKS_BG_SURFACE);
    gradHaut.addColorStop(1, NKS_BG_PRIMARY);
    ctx.fillStyle = gradHaut;
    ctx.fillRect(0, 0, LARGEUR, 420);

    const logoW = 150;
    const logoH = (logoNks.height / logoNks.width) * logoW;
    ctx.drawImage(logoNks, (LARGEUR - logoW) / 2, 48, logoW, logoH);

    ctx.textAlign = 'center';
    ctx.fillStyle = NKS_GOLD_LIGHT;
    ctx.font = "700 26px 'Cinzel Decorative', 'Playfair Display SC', serif";
    const yTitre = this.texteMultiligne(ctx, donnees.soireeNom.toUpperCase(), LARGEUR / 2, 48 + logoH + 46, LARGEUR - 64, 32);

    ctx.fillStyle = NKS_TEXT_SECONDARY;
    ctx.font = '400 15px Inter, system-ui, sans-serif';
    ctx.fillText(this.formatDate(donnees.soireeDateHeure), LARGEUR / 2, yTitre + 14);
    if (donnees.soireeLieu) {
      ctx.fillText(donnees.soireeLieu, LARGEUR / 2, yTitre + 38);
    }

    // ── Bande diagonale : QR code + catégorie (structure "badge FESPACO") ──
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 430);
    ctx.lineTo(LARGEUR, 470);
    ctx.lineTo(LARGEUR, 630);
    ctx.lineTo(0, 590);
    ctx.closePath();
    ctx.fillStyle = NKS_BG_SURFACE;
    ctx.fill();
    ctx.strokeStyle = `rgba(201, 162, 39, 0.35)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    const qrTaille = 150;
    const qrX = 32;
    const qrY = 448;
    ctx.fillStyle = NKS_TEXT;
    ctx.fillRect(qrX - 8, qrY - 8, qrTaille + 16, qrTaille + 16);
    ctx.drawImage(qrImg, qrX, qrY, qrTaille, qrTaille);

    ctx.textAlign = 'left';
    ctx.fillStyle = NKS_TEXT;
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.fillText((donnees.categorieNom ?? 'BILLET').toUpperCase(), qrX + qrTaille + 24, qrY + 60);

    if (donnees.numeroBillet) {
      ctx.fillStyle = NKS_GOLD;
      ctx.font = '600 14px Inter, system-ui, sans-serif';
      ctx.fillText(`Billet ${donnees.numeroBillet}`, qrX + qrTaille + 24, qrY + 88);
    }

    // ── Bandeau bas : branding + spectateur (structure "bandeau FESPACO") ──
    const yBandeau = 650;
    const gradBas = ctx.createLinearGradient(0, yBandeau, 0, HAUTEUR);
    gradBas.addColorStop(0, NKS_GOLD);
    gradBas.addColorStop(1, NKS_GOLD_LIGHT);
    ctx.fillStyle = gradBas;
    ctx.fillRect(0, yBandeau, LARGEUR, HAUTEUR - yBandeau);

    const logoBasH = 46;
    const logoBasW = (logoTerrasse.width / logoTerrasse.height) * logoBasH;
    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, 28, yBandeau + 20, logoBasW + 12, logoBasH + 12, 8);
    ctx.fillStyle = NKS_TEXT;
    ctx.fill();
    ctx.restore();
    ctx.drawImage(logoTerrasse, 34, yBandeau + 26, logoBasW, logoBasH);

    ctx.textAlign = 'right';
    ctx.fillStyle = NKS_BG_PRIMARY;
    ctx.font = '700 18px Inter, system-ui, sans-serif';
    ctx.fillText(donnees.nomSpectateur, LARGEUR - 28, yBandeau + 48);

    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillText('NIGHT KARAOKE STARS', LARGEUR - 28, yBandeau + 72);

    ctx.font = '400 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(13, 13, 30, 0.75)';
    ctx.fillText('Présente ce billet à l\'entrée', LARGEUR - 28, HAUTEUR - 24);

    return canvas.toDataURL('image/png');
  }

  /** Déclenche le téléchargement du PNG généré — même pattern que download.util.ts
   *  (lien <a download> temporaire), sans Blob : canvas.toDataURL() suffit ici. */
  telecharger(dataUrl: string, nomFichier: string): void {
    const lien = document.createElement('a');
    lien.href = dataUrl;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
  }

  private chargerImage(src: string): Promise<HTMLImageElement> {
    let promesse = this.cacheLogos.get(src);
    if (!promesse) {
      promesse = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Image introuvable : ${src}`));
        img.src = src;
      });
      this.cacheLogos.set(src, promesse);
    }
    return promesse;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  }

  /** Retour à la ligne manuel (Canvas 2D n'a pas d'équivalent natif) — renvoie le y final. */
  private texteMultiligne(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    const mots = texte.split(' ');
    let ligne = '';
    let yy = y;
    for (const mot of mots) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (ctx.measureText(essai).width > maxWidth && ligne) {
        ctx.fillText(ligne, x, yy);
        ligne = mot;
        yy += lineHeight;
      } else {
        ligne = essai;
      }
    }
    if (ligne) ctx.fillText(ligne, x, yy);
    return yy;
  }

  private formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
}
