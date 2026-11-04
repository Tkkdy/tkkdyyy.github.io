// Decoded file bytes versus Base64 JSON wire bytes (including request overhead).
export const PUBLICATION_MAX_BYTES = 100_000_000;
export const PUBLICATION_REQUEST_MAX_BYTES = 140_000_000;
export function publicationRequestLimit(path) {
 return ['/api/proposals','/api/graphql'].includes(path) ? PUBLICATION_REQUEST_MAX_BYTES : 30_000_000;
}
