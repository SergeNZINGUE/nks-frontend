/**
 * Déclenche le téléchargement d'un Blob (ex. export CSV backend, `responseType: 'blob'`)
 * côté navigateur, sans dépendance externe (pattern Angular standard : lien <a> temporaire
 * + Blob URL révoquée immédiatement après le clic simulé).
 */
export function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = window.URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  window.URL.revokeObjectURL(url);
}
