import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { BeneficiaireRequest } from '@core/models';

/** Même règle que le champ téléphone du réservant. */
export const PATTERN_TELEPHONE = /^\+?[0-9]{8,15}$/;
export const MAX_BENEFICIAIRES = 10;

/**
 * Normalisation simple pour la détection de doublons uniquement (le serveur reste l'autorité) :
 * retire espaces/tirets/points/parenthèses, puis l'indicatif « + » ou « 00 » en préfixe.
 */
export function normaliserTelephone(valeur: string | null | undefined): string {
  let t = (valeur ?? '').replace(/[\s\-.()]/g, '');
  if (t.startsWith('+')) t = t.slice(1);
  else if (t.startsWith('00')) t = t.slice(2);
  return t;
}

/** Index (0-based) du premier billet précédent portant le même numéro, ou -1. */
export function indexDoublon(valeurs: (string | null | undefined)[], i: number): number {
  const courant = normaliserTelephone(valeurs[i]);
  if (!courant) return -1;
  for (let j = 0; j < i; j++) {
    if (normaliserTelephone(valeurs[j]) === courant) return j;
  }
  return -1;
}

/** Validateur de FormArray : erreur `doublons` si deux billets partagent le même numéro. */
export function validateurDoublons(control: AbstractControl): ValidationErrors | null {
  const valeurs = ((control as FormArray).controls ?? []).map(c => (c.get('telephone')?.value as string) ?? '');
  return valeurs.some((_, i) => indexDoublon(valeurs, i) !== -1) ? { doublons: true } : null;
}

export function creerBeneficiaireGroup(fb: FormBuilder): FormGroup {
  return fb.group({
    telephone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(PATTERN_TELEPHONE)] }),
  });
}

export function creerBeneficiairesArray(fb: FormBuilder, n: number, max = MAX_BENEFICIAIRES): FormArray {
  const arr = new FormArray<FormGroup>([], validateurDoublons);
  synchroniserBeneficiaires(fb, arr, n, max);
  return arr;
}

/**
 * Ajoute/retire des lignes en fin de tableau pour suivre `nbPlaces`, sans toucher aux valeurs déjà
 * saisies. Pour une seule place, le fieldset "un numéro par billet" est masqué côté template (le
 * téléphone principal du formulaire en tient lieu) : le tableau est alors désactivé pour qu'une
 * ligne non renseignée ne bloque pas la validité globale du formulaire.
 */
export function synchroniserBeneficiaires(fb: FormBuilder, arr: FormArray, nbPlaces: unknown, max = MAX_BENEFICIAIRES): void {
  const n = Math.floor(Number(nbPlaces));
  if (!Number.isFinite(n) || n < 1) return; // saisie transitoire (champ vidé) : on conserve les lignes
  const cible = Math.min(n, max);
  if (arr.disabled) arr.enable({ emitEvent: false }); // ré-active avant de manipuler les lignes
  while (arr.length < cible) arr.push(creerBeneficiaireGroup(fb));
  while (arr.length > cible) arr.removeAt(arr.length - 1);
  if (cible === 1) arr.disable({ emitEvent: false });
}

/**
 * Au moment précis où `nbPlaces` passe de 1 à plusieurs, copie le téléphone principal dans la
 * première ligne du fieldset pour éviter à l'utilisateur de retaper le même numéro. À n'appeler
 * qu'à cette transition : la ligne reste ensuite librement modifiable et ne se resynchronise plus.
 */
export function preremplirPremierBeneficiaire(arr: FormArray, telephonePrincipal: string): void {
  arr.at(0)?.get('telephone')?.setValue(telephonePrincipal ?? '');
}

/**
 * Corps `beneficiaires` envoyé au serveur : un objet `{telephone}` par billet.
 * Pour une seule place, le fieldset n'existe pas visuellement — le téléphone principal
 * (payeur/contact) sert aussi de numéro du billet, on ne consulte donc pas le tableau.
 */
export function versBeneficiairesRequest(telephonePrincipal: string, arr: FormArray, nbPlaces: unknown): BeneficiaireRequest[] {
  const n = Math.floor(Number(nbPlaces));
  if (n === 1) return [{ telephone: (telephonePrincipal ?? '').trim() }];
  return arr.controls.map(c => ({ telephone: ((c.get('telephone')?.value as string) ?? '').trim() }));
}
