// Quill (core) livre son thème "snow" en CSS brut, sans typings — cette
// déclaration ambiante permet l'import de son CSS depuis un composant
// standalone (bundlé par esbuild dans le chunk lazy de l'admin, pas dans le
// bundle initial public).
declare module 'quill/dist/quill.snow.css';
