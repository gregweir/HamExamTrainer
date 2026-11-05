/**
 * English / Français dictionary for the trainer's UI chrome.
 *
 * The QUESTION TEXTS need no dictionary: ISED ships official bilingual
 * question banks (question_fr/choices_fr on every CA question) and the US
 * NCVEC pools are English-only by nature — `localizeQuestion` picks the
 * right side. This module covers everything else: tabs, buttons, feedback,
 * verdict copy, the install dialog, the toast.
 *
 * Preference lifecycle mirrors theme.ts: a trainer-local override key wins,
 * the OS/browser language seeds the default, and every component re-reads
 * getLang() when the change event fires.
 */
export type Lang = 'en' | 'fr';

const STORAGE_KEY = 'tartanleaf.trainer.lang';
const CHANGE_EVENT = 'trainer-lang-change';

type Fn = (vars?: Record<string, string | number>) => string;

const en = {
  'tab.practice': 'Practice',
  'tab.review': 'Review',
  'tab.exam': 'Exam',
  'a11y.mode': 'Switch between light and dark mode',
  'a11y.bank': 'Choose an exam',
  'a11y.modes': 'Study modes',
  'install.button': 'Install',
  'install.title': 'Install the app',
  'install.sub': 'The trainer can live on your device. Once installed, it opens full-screen from your home screen and works offline — every question bank stays on the device.',
  'install.now': 'Install now',
  'install.close': 'Close',
  'install.ios.name': 'iPhone & iPad',
  'install.ios.s1': 'Open this site in Safari.',
  'install.ios.s2': 'Tap the Share button (square with an arrow).',
  'install.ios.s3': 'Tap Add to Home Screen, then Add.',
  'install.android.name': 'Android phone or tablet',
  'install.android.s1': 'Open this site in Chrome.',
  'install.android.s2': 'Tap the menu button (three dots).',
  'install.android.s3': 'Tap Install app (or Add to Home screen).',
  'install.desktop.name': 'Windows, Mac or Linux',
  'install.desktop.s1': 'Open this site in Chrome or Edge.',
  'install.desktop.s2': 'Look for the install icon at the right end of the address bar.',
  'install.desktop.s3': 'Click Install.',
  'ready': 'ready · {{s}} of {{n}} questions studied',
  'section.complete': 'Section {{s}} complete — progress saved locally.',
  'back.topics': '← Topics',
  'read.more': 'Read more in the RadioBook series',
  'list.new': 'new',
  'list.inProgress': 'in progress',
  'list.done': 'done',
  'list.nQuestions': '{{n}} questions',
  'list.nStudied': '{{s}}/{{n}} studied',
  'q.choicesAria': 'Answer choices',
  'q.correct': 'Correct.',
  'q.incorrect': 'Not quite — the highlighted answer is correct.',
  'q.answered': 'Answer recorded — the verdict comes at the end of the exam.',
  'q.draft': 'draft',
  'q.refs': 'Reference: {{refs}}',
  'q.next': 'Next question →',
  'q.figureAlt': 'Exam question diagram for {{id}}',
  'exam.title': 'Practice exam — {{b}}',
  'exam.introBody': '{{n}} questions drawn across the bank’s topics.',
  'exam.introVerdict': 'No feedback until the end — you get the same verdict the real exam gives: {{p}}% to pass',
  'exam.andHonours': ', {{p}}% for Honours',
  'exam.introResume': 'You can leave and resume any time — answers are kept locally.',
  'exam.start': 'Start the exam',
  'exam.questionN': 'Question {{i}} / {{n}}',
  'exam.answeredOf': '{{a}} answered · {{t}}',
  'exam.submit': 'Submit exam',
  'exam.previous': '← Previous',
  'exam.abandon': 'Abandon',
  'exam.goneShort': 'This question left the bank.',
  'exam.confirmSubmit': 'Submit with {{n}} unanswered? Unanswered questions count as incorrect.',
  'exam.passWord': 'PASS',
  'exam.failWord': 'FAIL',
  'exam.theBar': '{{c}} of {{n}} correct · the bar: pass {{p}}%{{h}}',
  'exam.honoursSuffix': ', Honours {{p}}%',
  'exam.unansweredLine': '{{n}} unanswered — counted as incorrect',
  'exam.honoursBadge': 'Honours — {{p}}% ≥ {{h}}%',
  'exam.sectionH': 'Section',
  'exam.correctH': 'Correct',
  'exam.ofH': 'Of',
  'exam.done': 'Done',
  'exam.prevAttempts': 'Previous attempts',
  'review.heading': 'Review ({{i}} / {{n}})',
  'review.empty': 'Nothing due right now — you have everything scheduled. Practice a topic instead, or come back tomorrow.',
  'review.done': 'Review complete — {{g}} good, {{m}} missed{{skip}}.',
  'review.skippedTail': ', {{n}} skipped',
  'review.gone': 'This question is no longer in the bank — skipped.',
  'review.gradesAria': 'How well did you know it?',
  'review.again': 'Again',
  'review.hard': 'Hard',
  'review.good': 'Good',
  'review.easy': 'Easy',
  'toast.newVersion': 'New version ready — a quick reload picks it up.',
  'toast.reload': 'Reload',
  'us.englishNote': 'US exams are offered in English only — their questions stay in English here.',
} satisfies Record<string, string | Fn>;

type Dict = typeof en;

const fr: Dict = {
  'tab.practice': 'Pratique',
  'tab.review': 'Révision',
  'tab.exam': 'Examen',
  'a11y.mode': 'Basculer entre le mode clair et le mode sombre',
  'a11y.bank': 'Choisir un examen',
  'a11y.modes': 'Modes d’étude',
  'install.button': 'Installer',
  'install.title': 'Installer l’application',
  'install.sub': 'Le logiciel d’étude peut vivre sur votre appareil. Une fois installé, il s’ouvre en plein écran depuis votre écran d’accueil et fonctionne hors ligne — toutes les banques de questions restent sur l’appareil.',
  'install.now': 'Installer maintenant',
  'install.close': 'Fermer',
  'install.ios.name': 'iPhone et iPad',
  'install.ios.s1': 'Ouvrez ce site dans Safari.',
  'install.ios.s2': 'Touchez le bouton Partager (carré avec une flèche).',
  'install.ios.s3': 'Touchez « Ajouter à l’écran d’accueil », puis « Ajouter ».',
  'install.android.name': 'Téléphone ou tablette Android',
  'install.android.s1': 'Ouvrez ce site dans Chrome.',
  'install.android.s2': 'Touchez le bouton de menu (trois points).',
  'install.android.s3': 'Touchez « Installer l’application » (ou « Ajouter à l’écran d’accueil »).',
  'install.desktop.name': 'Windows, Mac ou Linux',
  'install.desktop.s1': 'Ouvrez ce site dans Chrome ou Edge.',
  'install.desktop.s2': 'Cherchez l’icône d’installation à la droite de la barre d’adresse.',
  'install.desktop.s3': 'Cliquez sur Installer.',
  'ready': 'prêt · {{s}} de {{n}} questions à l’étude',
  'section.complete': 'Section {{s}} terminée — progression sauvegardée localement.',
  'back.topics': '← Sujets',
  'read.more': 'En savoir plus dans la série RadioBook',
  'list.new': 'nouveau',
  'list.inProgress': 'en cours',
  'list.done': 'complet',
  'list.nQuestions': '{{n}} questions',
  'list.nStudied': '{{s}}/{{n}} à l’étude',
  'q.choicesAria': 'Choix de réponse',
  'q.correct': 'Exact.',
  'q.incorrect': 'Pas tout à fait — la réponse en surbrillance est la bonne.',
  'q.answered': 'Réponse enregistrée — le verdict arrive à la fin de l’examen.',
  'q.draft': 'ébauche',
  'q.refs': 'Référence : {{refs}}',
  'q.next': 'Question suivante →',
  'q.figureAlt': 'Diagramme de la question d’examen {{id}}',
  'exam.title': 'Examen blanc — {{b}}',
  'exam.introBody': '{{n}} questions tirées dans l’ensemble des sujets de la banque.',
  'exam.introVerdict': 'Aucune rétroaction avant la fin — le verdict du vrai examen s’applique : {{p}}% pour réussir',
  'exam.andHonours': ', {{p}}% pour la mention d’honneur',
  'exam.introResume': 'Vous pouvez quitter et reprendre en tout temps — les réponses restent enregistrées sur l’appareil.',
  'exam.start': 'Commencer l’examen',
  'exam.questionN': 'Question {{i}} / {{n}}',
  'exam.answeredOf': '{{a}} répondues · {{t}}',
  'exam.submit': 'Remettre l’examen',
  'exam.previous': '← Précédente',
  'exam.abandon': 'Abandonner',
  'exam.goneShort': 'Cette question a quitté la banque.',
  'exam.confirmSubmit': 'Remettre avec {{n}} questions sans réponse? Les questions sans réponse comptent comme incorrectes.',
  'exam.passWord': 'RÉUSSITE',
  'exam.failWord': 'ÉCHEC',
  'exam.theBar': '{{c}} de {{n}} correctes · la barre : {{p}}% pour réussir{{h}}',
  'exam.honoursSuffix': ', Mention d’honneur {{p}}%',
  'exam.unansweredLine': '{{n}} sans réponse comptées comme incorrectes',
  'exam.honoursBadge': 'Mention d’honneur — {{p}}% ≥ {{h}}%',
  'exam.sectionH': 'Section',
  'exam.correctH': 'Correctes',
  'exam.ofH': 'Sur',
  'exam.done': 'Terminer',
  'exam.prevAttempts': 'Tentatives précédentes',
  'review.heading': 'Révision ({{i}} / {{n}})',
  'review.empty': 'Rien à réviser pour l’instant — tout est planifié. Pratiquez un sujet, ou revenez demain.',
  'review.done': 'Révision terminée — {{g}} réussies, {{m}} manquées{{skip}}.',
  'review.skippedTail': ', {{n}} sautées',
  'review.gone': 'Cette question n’est plus dans la banque — sautée.',
  'review.gradesAria': 'Connaissiez-vous la matière?',
  'review.again': 'Recommencer',
  'review.hard': 'Difficile',
  'review.good': 'Bien',
  'review.easy': 'Facile',
  'toast.newVersion': 'Nouvelle version prête — un rechargement rapide l’installe.',
  'toast.reload': 'Recharger',
  'us.englishNote': 'Les examens américains se donnent en anglais seulement — leurs questions restent en anglais ici.',
};

const dicts: Record<Lang, Dict> = { en, fr };

let current: Lang = 'en';

function seed(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr') return 'fr';
    if (stored === 'en') return 'en';
  } catch { /* storage unavailable: fall through to the language read */ }
  try {
    const nav = navigator.language ?? '';
    if (nav.toLowerCase().startsWith('fr')) return 'fr';
  } catch { /* navigator unavailable: stay English */ }
  return 'en';
}
current = seed();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* non-fatal */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Subscribe to language changes; returns unsubscribe (components re-render). */
export function onLangChange(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

/** Interpolate {{key}} placeholders, then return the entry (typed, no missing keys). */
const placeholder = /\{\{(\w+)\}\}/g;
function interp(tpl: string, vars?: Record<string, string | number>): string {
  if (!vars) return tpl;
  return tpl.replace(placeholder, (raw, key) => (key in vars ? String(vars[key]) : raw));
}

/** The translated string for this app's current language, interpolated. */
export function t(key: keyof Dict, vars?: Record<string, string | number>): string {
  return interp(dicts[current][key], vars);
}

declare global {
  interface HTMLElementEventMap {
    [CHANGE_EVENT]: CustomEvent<{ lang: Lang }>;
  }
}
