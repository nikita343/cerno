import type { AppLanguage } from "@/lib/types";

/**
 * UI strings, in both languages.
 *
 * ---------------------------------------------------------------------------
 * Why a plain object and not an i18n library
 * ---------------------------------------------------------------------------
 *
 * Two languages, no plural rules beyond English's and Ukrainian's, no runtime
 * locale negotiation, no lazy-loaded bundles. `next-intl` or `i18next` would
 * bring routing middleware, a provider, message compilation and a build step to
 * do what a typed object and a hook already do — and every one of those has to
 * be understood by the next person.
 *
 * The one thing this gives up is translator tooling. If translation ever moves
 * outside the repo, this file is the extraction point.
 *
 * `en` is the source of truth: `Dictionary` is derived from it, so a missing
 * Ukrainian key is a type error rather than a string that silently renders in
 * the wrong language.
 *
 * Ukrainian plurals need three forms (1 / 2-4 / 5+), which is why counts go
 * through `plural()` in `format.ts` rather than being interpolated directly.
 */

export const en = {
  nav: {
    today: "Today",
    upcoming: "Upcoming",
    inbox: "Inbox",
    filters: "Filters & labels",
    filtersShort: "Filters",
    search: "Search",
    workspaces: "Workspaces",
    workspacesShort: "Teams",
    settings: "Settings",
    labels: "Labels",
  },
  settings: {
    title: "Settings",
    profile: "Profile",
    profileNote: "Name and photo",
    plan: "Plan & billing",
    planNote: "Team, invoices, cancellation",
    reminders: "Reminders",
    remindersNote: "What the bell warns you about",
    language: "Language & region",
    languageNote: "Language and timezone",
    calendar: "Calendar feed",
    calendarNote: "Subscribe from Google or Apple",
    model: "Planning model",
    modelNote: "Which model plans your day",
    displayName: "Display name",
    change: "Change",
    languageLabel: "Language",
    timezone: "Timezone",
    savedAsYouGo: "Saved as you go.",
  },
  onboarding: {
    title: "Choose your language",
    subtitle: "You can change this any time in Settings.",
    continue: "Continue",
  },
  common: {
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    later: "Later",
    loading: "Loading…",
  },
  workspace: {
    people: "People",
    invite: "Invite",
    copyLink: "Copy link",
    manage: "Manage & invite",
    newWorkspace: "New workspace",
    seatsLeft: "seats left",
    owner: "Owner",
    admin: "Admin",
    member: "Member",
  },
} as const;

/** Shape of every dictionary, derived from English so gaps are type errors. */
export type Dictionary = {
  [Section in keyof typeof en]: { [Key in keyof (typeof en)[Section]]: string };
};

export const uk: Dictionary = {
  nav: {
    today: "Сьогодні",
    upcoming: "Майбутнє",
    inbox: "Вхідні",
    filters: "Фільтри та мітки",
    filtersShort: "Фільтри",
    search: "Пошук",
    workspaces: "Робочі простори",
    workspacesShort: "Команди",
    settings: "Налаштування",
    labels: "Мітки",
  },
  settings: {
    title: "Налаштування",
    profile: "Профіль",
    profileNote: "Ім’я та фото",
    plan: "Тариф і оплата",
    planNote: "Команда, рахунки, скасування",
    reminders: "Нагадування",
    remindersNote: "Про що попереджає дзвіночок",
    language: "Мова та регіон",
    languageNote: "Мова та часовий пояс",
    calendar: "Стрічка календаря",
    calendarNote: "Підписка з Google або Apple",
    model: "Модель планування",
    modelNote: "Яка модель планує ваш день",
    displayName: "Ім’я для показу",
    change: "Змінити",
    languageLabel: "Мова",
    timezone: "Часовий пояс",
    savedAsYouGo: "Зберігається автоматично.",
  },
  onboarding: {
    title: "Оберіть мову",
    subtitle: "Це можна будь-коли змінити в налаштуваннях.",
    continue: "Продовжити",
  },
  common: {
    cancel: "Скасувати",
    save: "Зберегти",
    delete: "Видалити",
    edit: "Редагувати",
    close: "Закрити",
    later: "Пізніше",
    loading: "Завантаження…",
  },
  workspace: {
    people: "Учасники",
    invite: "Запросити",
    copyLink: "Копіювати посилання",
    manage: "Керувати та запрошувати",
    newWorkspace: "Новий робочий простір",
    seatsLeft: "місць вільно",
    owner: "Власник",
    admin: "Адміністратор",
    member: "Учасник",
  },
};

export const DICTIONARIES: Record<AppLanguage, Dictionary> = { en, uk };
