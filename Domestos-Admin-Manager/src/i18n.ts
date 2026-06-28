// Bulgarian UI strings + small formatting helpers. Single source of copy so the
// dashboard reads consistently. Toilet-type labels mirror the main app's
// LanguageContext (Bulgarian).

export const t = {
  appTitle: 'Табло на кампанията',
  appSubtitle: 'Domestos × toaletna.com',

  // Auth
  signInTitle: 'Табло на кампанията',
  signInLead: 'Проследявайте представянето на инициативата Domestos × toaletna.com в реално време.',
  signInButton: 'Вход с Google',
  signingIn: 'Влизане…',
  signInError: 'Входът не бе успешен. Опитайте отново.',
  deniedTitle: 'Нямате достъп',
  deniedBody:
    'Този профил няма право да преглежда таблото на кампанията. Ако смятате, че това е грешка, свържете се с екипа на toaletna.com.',
  signOut: 'Изход',
  loggedInAs: 'Влезли сте като',

  // Header / status
  refresh: 'Обнови',
  refreshing: 'Обновяване…',
  updated: 'Обновено',
  campaignPeriod: 'Период',
  statusActive: 'Активна',
  statusEnded: 'Приключила',
  statusUpcoming: 'Предстояща',
  roleAdmin: 'Администратор',
  roleDomestos: 'Domestos',

  // Tabs / navigation
  navUsers: 'Активни потребители',
  navDomestos: 'Domestos локации',
  navActivity: 'Активност',

  // KPI cards
  newLocations: 'Нови локации',
  reviews: 'Оценки',
  participants: 'Участници',
  participantsHint: 'Уникални хора, добавили или оценили локация в периода',
  inWindow: 'в периода',
  allTime: 'общо',
  domestosLocations: 'Domestos локации',
  domestosAvgLabel: 'среден рейтинг',
  rated: 'с оценки',

  // Users view
  usersTitle: 'Най-активни потребители',
  usersDesc:
    'Подредени по брой добавени локации. Кликнете върху ред, за да видите всички локации и оценки на потребителя.',
  colUser: 'Потребител',
  colAdded: 'Локации',
  colReviews: 'Оценки',
  filterAll: 'Всички',
  filterCampaign: 'Само в кампанията',
  exportCsv: 'Експортирай CSV',
  noUsers: 'Все още няма активност от потребители.',
  noUsersCampaign: 'Все още няма активност в периода на кампанията.',
  userLocationsCol: 'Добавени локации',
  userReviewsCol: 'Оставени оценки',
  noUserLocations: 'Няма добавени локации.',
  noUserReviews: 'Няма оставени оценки.',
  badgeAdded: 'Добавя',
  badgeReviewed: 'Оценява',
  badgeAddedTitle: 'Добавил локация в кампанията',
  badgeReviewedTitle: 'Оставил оценка в кампанията',

  // Campaign-window group dividers
  groupDuring: 'В кампанията',
  groupBefore: 'Преди кампанията',

  // Domestos view
  domestosTitle: 'Domestos локации',
  domestosDesc:
    'Специалните локации със значка Domestos и как се представят. Класирани по претеглена оценка.',
  domestosBoardTitle: 'Класация',
  domestosBoardDesc: 'Оценените Domestos локации — от най-добре представящата се надолу.',
  awaitingTitle: 'Локации без оценка',
  awaitingDesc: 'Отбелязани Domestos локации, които все още нямат оценки.',
  noDomestosTitle: 'Все още няма Domestos локации',
  noDomestosDesc:
    'Отбележете локации със значка Domestos от админ панела на toaletna.com и те ще се появят тук.',
  noDomestosRated: 'Никоя Domestos локация още няма оценки. Появят ли се, класацията ще се подреди тук.',

  // Activity view
  activityTitle: 'Скорошна активност',
  activityDesc: 'Последните оценки и новодобавени локации в платформата.',
  recentReviews: 'Последни оценки',
  recentLocations: 'Последно добавени локации',
  noRecentReviews: 'Все още няма оценки.',
  noRecentLocations: 'Все още няма добавени локации.',
  addedBy: 'от',
  addedLabel: 'Добавена',
  anonymous: 'анонимен',
  awaitingReviewBadge: 'Без оценки',
  idLabel: 'ID',

  // Leaderboard columns
  colRank: '#',
  colLocation: 'Локация',
  colRating: 'Рейтинг',
  colScore: 'Точки',
  winnerBadge: 'Победител',
  scoreTooltip: 'Претеглена оценка по Бейсовия метод (вижте „Методология“)',

  // Ranking explainer
  explainTitle: 'Методология: как се определя класирането',
  explainToggleOpen: 'Скрий',
  explainToggleClosed: 'Покажи',

  // Errors
  errorTitle: 'Възникна грешка',
  errorBody: 'Данните не можаха да се заредят. Опитайте да обновите.',
  tryAgain: 'Опитай отново',
} as const;

const TYPE_LABELS: Record<string, string> = {
  public: 'Обществена',
  EKOTOI: 'EKOTOI',
  restaurant: 'Ресторант',
  cafe: 'Кафене',
  'gas-station': 'Бензиностанция',
  mall: 'Магазин | Мол',
  other: 'Друго',
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] || TYPE_LABELS.other;
}

/** Display name for a location: its title, or a localized fallback from the type. */
export function locationName(title: string | null, type: string): string {
  const trimmed = title?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : typeLabel(type);
}

const numberFmt = new Intl.NumberFormat('bg-BG');
export const fmtNum = (n: number) => numberFmt.format(n ?? 0);

/** One-decimal rating, Bulgarian decimal comma (e.g. 4,5). */
export const fmtRating = (n: number) =>
  (Math.round((n ?? 0) * 10) / 10).toLocaleString('bg-BG', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

/** Two-decimal Bayesian score (e.g. 4,40). */
export const fmtScore = (n: number) =>
  (n ?? 0).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateFmt = new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

const timeFmt = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
export const fmtDateTime = (iso: string) => timeFmt.format(new Date(iso));

/** Short Bulgarian relative time ("преди 3 ч", "преди 2 дни"). */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'току-що';
  if (min < 60) return `преди ${min} мин`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `преди ${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `преди ${days} ${days === 1 ? 'ден' : 'дни'}`;
  return fmtDate(iso);
}
