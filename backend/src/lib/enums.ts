/**
 * Valeurs des « enums » métier, déclarées comme constantes partagées.
 *
 * Pourquoi pas les enums Prisma directement ?
 *  - En production (PostgreSQL, prisma/schema.prisma) ce sont de vrais enums,
 *    importés depuis '@prisma/client'.
 *  - En dev local (SQLite, prisma/dev/schema.prisma) SQLite ne supporte pas les
 *    enums : les colonnes sont des String. Ces constantes remplacent alors les
 *    enums Prisma, et `as const` donne le même niveau de typage strict.
 *
 * Règle : quand une valeur d'enum est utilisée dans le code, importer depuis ce
 * fichier plutôt que depuis '@prisma/client' (sauf les enums qui restent réels
 * en prod — voir le commentaire de chaque bloc).
 */

// --- Valeurs (identiques des deux côtés) ---

export const ENVIRONMENT_TYPES = ['PRIVATE', 'SHARED'] as const;
export type EnvironmentTypeValue = (typeof ENVIRONMENT_TYPES)[number];

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];

export const PROPOSAL_STATUSES = ['NONE', 'PENDING', 'ACCEPTED', 'DECLINED'] as const;
export type ProposalStatusValue = (typeof PROPOSAL_STATUSES)[number];

export const DEVICE_TYPES = ['IOS', 'ANDROID', 'WEB'] as const;
export type DeviceTypeValue = (typeof DEVICE_TYPES)[number];

// --- Helpers de validation (utilisés à la place de Object.values(EnumPrisma)) ---

export function isTaskStatus(value: unknown): value is TaskStatusValue {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export function isDeviceType(value: unknown): value is DeviceTypeValue {
  return typeof value === 'string' && (DEVICE_TYPES as readonly string[]).includes(value);
}
