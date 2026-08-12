import { HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs';
import { environment } from '@env/environment';

/** Coupe toute requête au-delà de ce délai : évite un écran figé si le backend ne répond pas. */
const DELAI_MAX_MS = 8000;

/**
 * Délai large pour les uploads directs vers Cloudinary (MediaService.uploadToCloudinary) :
 * ce sont les SEULES requêtes qui ne ciblent pas environment.apiUrl. Bug trouvé le 09/08/2026 —
 * le délai de 8s s'appliquait aussi aux vidéos jusqu'à 100 Mo, coupant systématiquement l'upload
 * sur une connexion lente (typiquement mobile) avant même que le transfert n'ait une chance de finir.
 */
const DELAI_UPLOAD_MS = 120_000;

export const httpTimeoutInterceptor: HttpInterceptorFn = (req, next) => {
  const delai = req.url.startsWith(environment.apiUrl) ? DELAI_MAX_MS : DELAI_UPLOAD_MS;
  return next(req).pipe(timeout(delai));
};
