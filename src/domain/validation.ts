import {
  ensureUncategorizedCategory,
  UNCATEGORIZED_CATEGORY_ID,
} from './categories'
import {
  normalizeBudgetCategoryIds,
  validateBudgetCategoryIds,
} from './budget-service'
import type {
  AppLockPinVerifier,
  AppSettings,
  Budget,
  Category,
  CategoryKind,
  CategorySystem,
  DeviceAuthCredential,
  DeviceAuthTransport,
  FinanceState,
  RecoveryCodeSet,
  RecoveryCodeVerifier,
  RecurringTemplate,
  RecurringFrequency,
  ThemeMode,
  Transaction,
  TransactionType,
} from './models'

const legacyBackupPreferenceDefaults = {
  hasSeenPrivacyModal: true,
  backupRemindersEnabled: true,
  lastBackupAt: null,
  backupReminderBaselineAt: null,
  changesSinceBackup: 0,
  lastReminderAt: null,
  hideOverspendingBudgetsInHome: false,
  hideSensitiveData: false,
  lockAppOnLaunch: false,
  appLockPinVerifier: null,
  deviceAuthCredential: null,
  recoveryCodeSet: null,
} as const

const APP_LOCK_PIN_VERIFIER_ITERATIONS = 200_000
const APP_LOCK_PIN_SALT_HEX_LENGTH = 32
const APP_LOCK_PIN_VERIFIER_HEX_LENGTH = 64
const RECOVERY_CODE_SALT_HEX_LENGTH = 32
const RECOVERY_CODE_VERIFIER_HEX_LENGTH = 64

interface ParsedBudgetCandidate {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  categoryIds: string[]
  monthKey: string
  limit: number
  recurring: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isHexString(value: unknown): value is string {
  return isString(value) && /^[0-9a-f]+$/i.test(value) && value.length > 0
}

function isHexStringWithLength(value: unknown, expectedLength: number): value is string {
  return isHexString(value) && value.length === expectedLength
}

function isBase64UrlString(value: unknown): value is string {
  return isString(value) && /^[A-Za-z0-9_-]+$/.test(value) && value.length > 0
}

function parseDeviceAuthTransport(value: unknown): DeviceAuthTransport | null {
  return value === 'usb' ||
    value === 'nfc' ||
    value === 'ble' ||
    value === 'internal' ||
    value === 'hybrid'
    ? value
    : null
}

function parseRecoveryCodeVerifier(value: unknown): RecoveryCodeVerifier | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    !isString(value.id) ||
    !isHexStringWithLength(value.verifierHex, RECOVERY_CODE_VERIFIER_HEX_LENGTH) ||
    !(value.usedAt === null || isString(value.usedAt))
  ) {
    return null
  }

  return {
    id: value.id,
    verifierHex: value.verifierHex,
    usedAt: value.usedAt,
  }
}

function isTransactionType(value: unknown): value is TransactionType {
  return value === 'income' || value === 'expense'
}

function isRecurringFrequency(value: unknown): value is RecurringFrequency {
  return value === 'monthly' || value === 'custom'
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'auto'
}

function isCategoryKind(value: unknown): value is CategoryKind {
  return value === 'income' || value === 'expense' || value === 'both'
}

function categorySupportsType(
  category: Pick<Category, 'kind'>,
  type: TransactionType,
): boolean {
  return category.kind === 'both' || category.kind === type
}

function hasBaseEntityFields(value: unknown): value is {
  id: string
  createdAt: string
  updatedAt: string
} & Record<string, unknown> {
  if (!isRecord(value)) {
    return false
  }

  return (
    isString(value.id) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

function parseCategory(value: unknown): Category | null {
  if (!hasBaseEntityFields(value)) {
    return null
  }

  if (!isString(value.name) || !isString(value.color) || !isCategoryKind(value.kind)) {
    return null
  }

  let system: CategorySystem = null

  if (value.system === 'uncategorized') {
    system = 'uncategorized'
  } else if (value.system === null || value.system === undefined) {
    system = null
  } else {
    return null
  }

  if (value.id === UNCATEGORIZED_CATEGORY_ID) {
    system = 'uncategorized'
  }

  return {
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    name: value.name,
    color: value.color,
    kind: value.kind,
    system,
  }
}

function isCategory(value: unknown): value is Category {
  return parseCategory(value) !== null
}

function parseTransaction(
  value: unknown,
  useLegacyRecurringDefaults: boolean,
): Transaction | null {
  if (!hasBaseEntityFields(value)) {
    return null
  }

  if (
    !isTransactionType(value.type) ||
    !isNumber(value.amount) ||
    !isString(value.categoryId) ||
    !isString(value.note) ||
    !isString(value.occurredAt)
  ) {
    return null
  }

  const recurringTemplateId =
    value.recurringTemplateId === null || isString(value.recurringTemplateId)
      ? value.recurringTemplateId
      : useLegacyRecurringDefaults
        ? null
        : undefined
  const recurringOccurrenceDate =
    value.recurringOccurrenceDate === null || isString(value.recurringOccurrenceDate)
      ? value.recurringOccurrenceDate
      : useLegacyRecurringDefaults
        ? null
        : undefined

  if (recurringTemplateId === undefined || recurringOccurrenceDate === undefined) {
    return null
  }

  return {
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    type: value.type,
    amount: value.amount,
    categoryId: value.categoryId,
    note: value.note,
    occurredAt: value.occurredAt,
    recurringTemplateId,
    recurringOccurrenceDate,
  }
}

function isTransaction(value: unknown): value is Transaction {
  return parseTransaction(value, false) !== null
}

function normalizeTransactionCategory(
  transaction: Transaction,
  categoriesById: Map<string, Category>,
): Transaction {
  const category = categoriesById.get(transaction.categoryId)

  if (category && categorySupportsType(category, transaction.type)) {
    return transaction
  }

  return {
    ...transaction,
    categoryId: UNCATEGORIZED_CATEGORY_ID,
  }
}

function parseBudgetCandidate(value: unknown): ParsedBudgetCandidate | null {
  if (!hasBaseEntityFields(value)) {
    return null
  }

  if (!isString(value.monthKey) || !isNumber(value.limit) || value.limit < 0) {
    return null
  }

  const categoryIds =
    isStringArray(value.categoryIds)
      ? normalizeBudgetCategoryIds(value.categoryIds)
      : isString(value.categoryId)
        ? normalizeBudgetCategoryIds([value.categoryId])
        : null

  if (categoryIds === null) {
    return null
  }

  const name = isString(value.name) ? value.name.trim() : ''

  return {
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    name,
    categoryIds,
    monthKey: value.monthKey,
    limit: value.limit,
    recurring: value.recurring === true,
  }
}

function buildBudgetFromCandidate(
  candidate: ParsedBudgetCandidate,
  categories: Category[],
  categoriesById: Map<string, Category>,
): Budget | null {
  const categoryIds = validateBudgetCategoryIds(candidate.categoryIds, categories)

  if (!Number.isFinite(candidate.limit) || candidate.limit <= 0 || categoryIds.length === 0) {
    return null
  }

  const fallbackName =
    categoryIds
      .map((categoryId) => categoriesById.get(categoryId)?.name ?? '')
      .filter(Boolean)
      .slice(0, 2)
      .join(' + ') || 'Budget'

  return {
    id: candidate.id,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    name: candidate.name || fallbackName,
    categoryIds,
    monthKey: candidate.monthKey,
    limit: candidate.limit,
    recurring: candidate.recurring,
  }
}

function isBudget(value: unknown): value is Budget {
  if (!hasBaseEntityFields(value)) {
    return false
  }

  return (
    isString(value.name) &&
    isStringArray(value.categoryIds) &&
    value.categoryIds.length > 0 &&
    isString(value.monthKey) &&
    isNumber(value.limit) &&
    value.limit > 0 &&
    (value.recurring === undefined || typeof value.recurring === 'boolean')
  )
}

function parseRecurringTemplate(value: unknown): RecurringTemplate | null {
  if (!hasBaseEntityFields(value)) {
    return null
  }

  if (
    !isTransactionType(value.type) ||
    !isNumber(value.amount) ||
    value.amount <= 0 ||
    !isString(value.categoryId) ||
    !isString(value.note) ||
    !isRecurringFrequency(value.frequency) ||
    !(value.intervalDays === null || isNonNegativeNumber(value.intervalDays)) ||
    !isString(value.startDate) ||
    !isString(value.nextDueDate) ||
    typeof value.active !== 'boolean'
  ) {
    return null
  }

  return {
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    type: value.type,
    amount: value.amount,
    categoryId: value.categoryId,
    note: value.note,
    frequency: value.frequency,
    intervalDays: value.intervalDays,
    startDate: value.startDate,
    nextDueDate: value.nextDueDate,
    active: value.active,
  }
}

function normalizeRecurringTemplateCategory(
  template: RecurringTemplate,
  categoriesById: Map<string, Category>,
): RecurringTemplate {
  const category = categoriesById.get(template.categoryId)

  if (category && categorySupportsType(category, template.type)) {
    return template
  }

  return {
    ...template,
    categoryId: UNCATEGORIZED_CATEGORY_ID,
  }
}

function parseRecurringTemplates(value: unknown): RecurringTemplate[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const parsedTemplates = value
    .map((entry) => parseRecurringTemplate(entry))
    .filter((entry): entry is RecurringTemplate => entry !== null)

  return parsedTemplates
}

function parseAppLockPinVerifier(value: unknown): AppLockPinVerifier | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    value.version !== 1 ||
    value.algorithm !== 'PBKDF2' ||
    value.hash !== 'SHA-256' ||
    !isNonNegativeNumber(value.iterations) ||
    value.iterations !== APP_LOCK_PIN_VERIFIER_ITERATIONS ||
    !isHexStringWithLength(value.saltHex, APP_LOCK_PIN_SALT_HEX_LENGTH) ||
    !isHexStringWithLength(value.verifierHex, APP_LOCK_PIN_VERIFIER_HEX_LENGTH)
  ) {
    return null
  }

  return {
    version: 1,
    algorithm: 'PBKDF2',
    hash: 'SHA-256',
    iterations: value.iterations,
    saltHex: value.saltHex,
    verifierHex: value.verifierHex,
  }
}

function parseDeviceAuthCredential(value: unknown): DeviceAuthCredential | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    value.version !== 1 ||
    !isBase64UrlString(value.credentialId) ||
    !isString(value.createdAt)
  ) {
    return null
  }

  const transports =
    value.transports === undefined
      ? undefined
      : Array.isArray(value.transports)
        ? value.transports
            .map((transport) => parseDeviceAuthTransport(transport))
            .filter((transport): transport is DeviceAuthTransport => transport !== null)
        : null

  if (transports === null) {
    return null
  }

  return {
    version: 1,
    credentialId: value.credentialId,
    createdAt: value.createdAt,
    ...(transports ? { transports } : {}),
  }
}

function parseRecoveryCodeSet(value: unknown): RecoveryCodeSet | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    value.version !== 1 ||
    value.hash !== 'SHA-256' ||
    !isHexStringWithLength(value.saltHex, RECOVERY_CODE_SALT_HEX_LENGTH) ||
    !isString(value.generatedAt) ||
    !Array.isArray(value.verifiers)
  ) {
    return null
  }

  if (value.verifiers.length === 0) {
    return null
  }

  const parsedVerifiers = value.verifiers
    .map((verifier) => parseRecoveryCodeVerifier(verifier))

  if (parsedVerifiers.some((verifier) => verifier === null)) {
    return null
  }

  const verifiers = parsedVerifiers as RecoveryCodeVerifier[]

  return {
    version: 1,
    hash: 'SHA-256',
    saltHex: value.saltHex,
    generatedAt: value.generatedAt,
    verifiers,
  }
}

function isAppSettings(value: unknown): value is AppSettings {
  if (!isRecord(value)) {
    return false
  }

  return (
    isThemeMode(value.theme) &&
    isString(value.currency) &&
    value.currency.length === 3 &&
    typeof value.hasSeenPrivacyModal === 'boolean' &&
    typeof value.backupRemindersEnabled === 'boolean' &&
    (value.lastBackupAt === null || isString(value.lastBackupAt)) &&
    (value.backupReminderBaselineAt === null || isString(value.backupReminderBaselineAt)) &&
    isNonNegativeNumber(value.changesSinceBackup) &&
    (value.lastReminderAt === null || isString(value.lastReminderAt)) &&
    (value.hideOverspendingBudgetsInHome === undefined ||
      typeof value.hideOverspendingBudgetsInHome === 'boolean') &&
    (value.hideSensitiveData === undefined || typeof value.hideSensitiveData === 'boolean') &&
    (value.lockAppOnLaunch === undefined || typeof value.lockAppOnLaunch === 'boolean') &&
    (value.appLockPinVerifier === undefined ||
      value.appLockPinVerifier === null ||
      parseAppLockPinVerifier(value.appLockPinVerifier) !== null) &&
    (value.deviceAuthCredential === undefined ||
      value.deviceAuthCredential === null ||
      parseDeviceAuthCredential(value.deviceAuthCredential) !== null) &&
    (value.recoveryCodeSet === undefined ||
      value.recoveryCodeSet === null ||
      parseRecoveryCodeSet(value.recoveryCodeSet) !== null)
  )
}

function parseAppSettings(
  value: unknown,
  useLegacyBackupDefaults: boolean,
): AppSettings | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    !isThemeMode(value.theme) ||
    !isString(value.currency) ||
    value.currency.length !== 3
  ) {
    return null
  }

  const hasSeenPrivacyModal =
    typeof value.hasSeenPrivacyModal === 'boolean'
      ? value.hasSeenPrivacyModal
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.hasSeenPrivacyModal
        : null
  const backupRemindersEnabled =
    typeof value.backupRemindersEnabled === 'boolean'
      ? value.backupRemindersEnabled
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.backupRemindersEnabled
        : null
  const lastBackupAt =
    value.lastBackupAt === null || isString(value.lastBackupAt)
      ? value.lastBackupAt
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.lastBackupAt
        : null
  const backupReminderBaselineAt =
    value.backupReminderBaselineAt === null || isString(value.backupReminderBaselineAt)
      ? value.backupReminderBaselineAt
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.backupReminderBaselineAt
        : null
  const changesSinceBackup = isNonNegativeNumber(value.changesSinceBackup)
    ? value.changesSinceBackup
    : useLegacyBackupDefaults
      ? legacyBackupPreferenceDefaults.changesSinceBackup
      : null
  const lastReminderAt =
    value.lastReminderAt === null || isString(value.lastReminderAt)
      ? value.lastReminderAt
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.lastReminderAt
        : null
  const hideOverspendingBudgetsInHome =
    typeof value.hideOverspendingBudgetsInHome === 'boolean'
      ? value.hideOverspendingBudgetsInHome
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.hideOverspendingBudgetsInHome
        : null
  const hideSensitiveData =
    typeof value.hideSensitiveData === 'boolean'
      ? value.hideSensitiveData
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.hideSensitiveData
        : null
  const lockAppOnLaunch =
    typeof value.lockAppOnLaunch === 'boolean'
      ? value.lockAppOnLaunch
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.lockAppOnLaunch
        : null
  const appLockPinVerifier =
    value.appLockPinVerifier === null || value.appLockPinVerifier === undefined
      ? useLegacyBackupDefaults && value.appLockPinVerifier === undefined
        ? legacyBackupPreferenceDefaults.appLockPinVerifier
        : null
      : parseAppLockPinVerifier(value.appLockPinVerifier)
  const deviceAuthCredential =
    value.deviceAuthCredential === null || value.deviceAuthCredential === undefined
      ? useLegacyBackupDefaults && value.deviceAuthCredential === undefined
        ? legacyBackupPreferenceDefaults.deviceAuthCredential
        : null
      : parseDeviceAuthCredential(value.deviceAuthCredential)
  const recoveryCodeSet =
    value.recoveryCodeSet === null || value.recoveryCodeSet === undefined
      ? useLegacyBackupDefaults && value.recoveryCodeSet === undefined
        ? legacyBackupPreferenceDefaults.recoveryCodeSet
        : null
      : parseRecoveryCodeSet(value.recoveryCodeSet)

  if (
    hasSeenPrivacyModal === null ||
    backupRemindersEnabled === null ||
    changesSinceBackup === null ||
    hideOverspendingBudgetsInHome === null ||
    hideSensitiveData === null ||
    lockAppOnLaunch === null ||
    appLockPinVerifier === undefined ||
    deviceAuthCredential === undefined ||
    recoveryCodeSet === undefined
  ) {
    return null
  }

  const hasPinFallback = appLockPinVerifier !== null
  const normalizedLockAppOnLaunch = hasPinFallback ? lockAppOnLaunch : false
  const normalizedDeviceAuthCredential = hasPinFallback ? deviceAuthCredential : null
  const normalizedRecoveryCodeSet = hasPinFallback ? recoveryCodeSet : null

  return {
    theme: value.theme,
    currency: value.currency,
    hasSeenPrivacyModal,
    backupRemindersEnabled,
    lastBackupAt,
    backupReminderBaselineAt,
    changesSinceBackup,
    lastReminderAt,
    hideOverspendingBudgetsInHome,
    hideSensitiveData,
    lockAppOnLaunch: normalizedLockAppOnLaunch,
    appLockPinVerifier,
    deviceAuthCredential: normalizedDeviceAuthCredential,
    recoveryCodeSet: normalizedRecoveryCodeSet,
  }
}

export function isFinanceState(value: unknown): value is FinanceState {
  if (!isRecord(value)) {
    return false
  }

  return (
    Array.isArray(value.categories) &&
    value.categories.every(isCategory) &&
    Array.isArray(value.transactions) &&
    value.transactions.every(isTransaction) &&
    Array.isArray(value.budgets) &&
    value.budgets.every(isBudget) &&
    Array.isArray(value.recurringTemplates) &&
    value.recurringTemplates.every((entry) => parseRecurringTemplate(entry) !== null) &&
    isAppSettings(value.settings)
  )
}

export function parsePersistedFinanceState(value: unknown): FinanceState | null {
  if (!isRecord(value)) {
    return null
  }

  const settings = parseAppSettings(value.settings, true)

  if (!settings || !Array.isArray(value.categories)) {
    return null
  }

  const parsedCategories = value.categories
    .map((category) => parseCategory(category))
    .filter((category): category is Category => category !== null)
  const categories = ensureUncategorizedCategory(parsedCategories)
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  )

  const transactions = Array.isArray(value.transactions)
    ? value.transactions
        .map((transaction) => parseTransaction(transaction, true))
        .filter((transaction): transaction is Transaction => transaction !== null)
        .map((transaction) => normalizeTransactionCategory(transaction, categoriesById))
    : null

  if (transactions === null || !Array.isArray(value.budgets)) {
    return null
  }

  const budgetsById = new Map<string, Budget>()
  value.budgets
    .map((budget) => parseBudgetCandidate(budget))
    .filter((budget): budget is ParsedBudgetCandidate => budget !== null)
    .forEach((budget) => {
      const normalizedBudget = buildBudgetFromCandidate(
        budget,
        categories,
        categoriesById,
      )

      if (normalizedBudget) {
        budgetsById.set(normalizedBudget.id, normalizedBudget)
      }
    })

  const recurringTemplatesRaw =
    value.recurringTemplates === undefined ? [] : value.recurringTemplates
  const recurringTemplatesParsed = parseRecurringTemplates(recurringTemplatesRaw)

  if (recurringTemplatesParsed === null) {
    return null
  }

  const recurringTemplates = recurringTemplatesParsed.map((template) =>
    normalizeRecurringTemplateCategory(template, categoriesById),
  )

  return {
    categories,
    transactions,
    budgets: [...budgetsById.values()],
    recurringTemplates,
    settings,
  }
}
