const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rýchla kontrola tvaru UUID pred dotazom do databázy. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
