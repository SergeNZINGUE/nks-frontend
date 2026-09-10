NKS — Templates e-mail transactionnels (candidature)
=====================================================
Aperçu visuel : https://claude.ai/code/artifact/d40a5107-9e09-419e-a5aa-559938f2051e
Logo hébergé sur le compte Cloudinary du projet : https://res.cloudinary.com/uzonwmij/image/upload/w_140/v1787486658/nks/email-logo.png

À FAIRE avant intégration
--------------------------
1. Ajouter une variable d'environnement FRONTEND_BASE_URL (ex: http://localhost:4200 en dev,
   https://laterrasse.bf en prod, http://homolnks.laterrasse.bf en homologation), injectée dans
   CandidatureService pour construire l'URL du bouton "Accéder à mon espace" (ctaUrl ci-dessous).
   Actuellement aucun endpoint/constante backend ne connaît l'URL du frontend.
2. Coller la méthode utilitaire ci-dessous dans CandidatureService.java (ou la déplacer dans
   NotificationService si tu préfères centraliser — elle ne dépend d'aucun état de CandidatureService).
3. Remplacer les 4 corps d'e-mail existants (lignes ~132, ~163, ~190, ~236) par les appels
   fournis plus bas — le contenu texte est IDENTIQUE à l'existant, seul l'habillage change.

Méthode utilitaire (à coller une fois)
----------------------------------------
private String construireEmailHtml(String prenom, String titre, String contenuHtml, String ctaLabel, String ctaUrl) {
    String bouton = (ctaLabel != null && ctaUrl != null) ? """
        <tr>
          <td align="center" style="padding:28px 40px 4px;">
            <a href="%s" style="display:inline-block;padding:14px 34px;background:#C9A227;color:#0D0D1E;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;letter-spacing:.3px;">%s</a>
          </td>
        </tr>
        """.formatted(ctaUrl, ctaLabel) : "";

    return """
        <!DOCTYPE html>
        <html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#0D0D1E;">
        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#0D0D1E;">
          <tr><td align="center" style="padding:24px 12px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;background:#1A1A2E;border:1px solid #3A3A5C;border-radius:20px;overflow:hidden;">
              <tr><td align="center" style="padding:40px 40px 0;">
                <img src="https://res.cloudinary.com/uzonwmij/image/upload/w_140/v1787486658/nks/email-logo.png" width="140" alt="Night Karaoke Stars" style="display:block;border:0;outline:none;">
                <div style="width:56px;height:2px;background:#C9A227;margin:24px auto 0;"></div>
              </td></tr>
              <tr><td align="center" style="padding:24px 40px 0;">
                <h1 style="margin:0;font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-weight:700;font-size:23px;letter-spacing:.3px;color:#E8C04A;">%s</h1>
              </td></tr>
              <tr><td style="padding:20px 40px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#C8C8D0;">
                <p style="margin:0 0 16px;">Bonjour <strong style="color:#FFFFFF;">%s</strong>,</p>
                %s
              </td></tr>
              %s
              <tr><td align="center" style="padding:36px 40px 32px;">
                <div style="width:100%%;height:1px;background:#3A3A5C;margin:0 0 24px;"></div>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#7A7A8C;">
                  Night Karaoke Stars — La Terrasse, Ouagadougou<br>
                  Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
        </body></html>
        """.formatted(titre, prenom, contenuHtml, bouton);
}

/** Encadré mis en avant (code candidat, mot de passe temporaire, etc.) — usage optionnel. */
private String encadre(String valeur, boolean mono) {
    String police = mono ? "'Courier New',Courier,monospace" : "Arial,Helvetica,sans-serif";
    return """
        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#252540;border-left:3px solid #C9A227;border-radius:8px;margin:4px 0 0;">
          <tr><td style="padding:14px 18px;font-family:%s;font-size:17px;color:#FFFFFF;font-weight:700;word-break:break-all;">%s</td></tr>
        </table>
        """.formatted(police, valeur);
}

------------------------------------------------------------
1. CANDIDATURE_RECUE (ligne ~129-142)
------------------------------------------------------------
String sms = "NKS : dossier reçu, code candidat " + codeCandidat
        + (motDePasseTemp != null ? ", mot de passe temporaire : " + motDePasseTemp : "")
        + ". Vous serez notifié après examen.";

String contenu = "<p style=\"margin:0 0 8px;\">Votre dossier de candidature a bien été reçu. Votre code candidat est :</p>"
        + encadre(codeCandidat, true)
        + (motDePasseTemp != null
                ? "<p style=\"margin:20px 0 8px;\">Votre mot de passe temporaire :</p>"
                        + encadre(motDePasseTemp, true)
                        + "<p style=\"margin:10px 0 0;font-size:13px;color:#F39C12;\">À changer dès votre première connexion.</p>"
                : "")
        + "<p style=\"margin:20px 0 0;\">L'équipe NKS examinera votre dossier prochainement.</p>";

String emailCorps = construireEmailHtml(utilisateur.getPrenom(), "Candidature reçue", contenu,
        "Accéder à mon espace", frontendBaseUrl + "/login");

notificationService.envoyerSmsEtEmail(utilisateur, utilisateur.getTelephone(), utilisateur.getEmail(),
        TypeNotification.CANDIDATURE_RECUE, sms, "NKS — Candidature reçue", emailCorps);

------------------------------------------------------------
2. CANDIDATURE_VALIDEE (ligne ~157-167)
------------------------------------------------------------
String contenu = "<p style=\"margin:0;\">Félicitations, votre candidature a été acceptée. Connectez-vous à votre"
        + " espace pour procéder au paiement des frais d'inscription et activer votre profil.</p>";

String emailCorps = construireEmailHtml(candidat.getPrenom(), "Candidature acceptée", contenu,
        "Payer mes frais d'inscription", frontendBaseUrl + "/login");

notificationService.envoyerSmsEtEmail(candidat, candidat.getTelephone(), candidat.getEmail(),
        TypeNotification.CANDIDATURE_VALIDEE,
        "NKS : candidature acceptée ! Connectez-vous pour régler vos frais d'inscription.",
        "NKS — Candidature acceptée", emailCorps);

------------------------------------------------------------
3. CANDIDATURE_REJETEE (ligne ~183-194)
------------------------------------------------------------
String contenu = "<p style=\"margin:0 0 16px;\">Nous vous remercions pour votre candidature. Elle n'a"
        + " malheureusement pas été retenue.</p>"
        + "<p style=\"margin:0 0 6px;color:#FFFFFF;font-weight:700;\">Motif :</p>"
        + "<p style=\"margin:0;\">" + motifRejet + "</p>";

String emailCorps = construireEmailHtml(candidat.getPrenom(), "Candidature non retenue", contenu, null, null);

notificationService.envoyerSmsEtEmail(candidat, candidat.getTelephone(), candidat.getEmail(),
        TypeNotification.CANDIDATURE_REJETEE,
        "NKS : votre candidature n'a pas été retenue. Motif : " + tronquer(motifRejet, 100),
        "NKS — Candidature non retenue", emailCorps);

------------------------------------------------------------
4. PROFIL_ACTIVE / paiement confirmé (ligne ~230-240)
------------------------------------------------------------
String contenu = "<p style=\"margin:0;\">Votre paiement a été confirmé. Votre profil candidat est maintenant"
        + " actif et visible sur la galerie publique NKS.</p>";

String emailCorps = construireEmailHtml(utilisateur.getPrenom(), "Profil activé", contenu,
        "Voir mon profil public", frontendBaseUrl + "/galerie");

notificationService.envoyerSmsEtEmail(utilisateur, utilisateur.getTelephone(), utilisateur.getEmail(),
        TypeNotification.PROFIL_ACTIVE,
        "NKS : paiement confirmé, votre profil est désormais actif et visible publiquement !",
        "NKS — Profil activé", emailCorps);

------------------------------------------------------------
Notes
------------------------------------------------------------
- Textes SMS strictement inchangés (contrainte longueur SMS déjà validée par l'équipe, non touchée).
- URL du bouton "Voir mon profil public" (/galerie) à ajuster si la route publique porte un autre nom
  côté frontend — vérifier app.routes.ts.
- Le logo est hébergé sur le Cloudinary du projet (dossier nks/email-logo) — accessible publiquement,
  pas besoin d'authentification pour que les clients mail l'affichent.
