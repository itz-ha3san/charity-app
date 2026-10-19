export class DomainError extends Error {
    constructor(public readonly status: 400 | 403 | 404 | 409, public readonly error: string, public readonly details: Record<string, unknown> = {}) {
        super(error);
        this.name = 'DomainError';
    }
}
/** Do not automatically retry a non-idempotent business command. Ask the caller to refresh. */
export const isConcurrencyConflict = (code?: string) => Boolean(code && ['40001', '40P01', '55P03'].includes(code));
