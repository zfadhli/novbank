// ---------------------------------------------------------------------------
// Novbank — Custom error classes
// ---------------------------------------------------------------------------
// Hierarchical errors so consumers can catch specific failure modes.
// Every error includes structured metadata for programmatic handling.
// ---------------------------------------------------------------------------

/**
 * Base error for the entire library.
 * All other errors extend this so consumers can catch everything
 * novbank-related with `instanceof NovelDownloadError`.
 */
export class NovelDownloadError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions & { readonly context?: Record<string, unknown> },
  ) {
    super(message, options);
    this.name = 'NovelDownloadError';
    this.context = options?.context ?? {};
  }

  /** Arbitrary structured metadata attached at the throw site. */
  readonly context: Record<string, unknown>;
}

// ─── Network errors ──────────────────────────────────────────────────────────

/**
 * Something went wrong while talking to the remote server.
 * This includes HTTP errors, timeouts, DNS failures, etc.
 */
export class NetworkError extends NovelDownloadError {
  constructor(
    message: string,
    options?: ErrorOptions & {
      readonly context?: Record<string, unknown>;
      readonly statusCode?: number;
      readonly url?: string;
    },
  ) {
    super(message, {
      ...options,
      context: { statusCode: options?.statusCode, url: options?.url, ...options?.context },
    });
    this.name = 'NetworkError';
    this.statusCode = options?.statusCode ?? null;
    this.url = options?.url ?? null;
  }

  /** HTTP status code if the server responded, otherwise `null`. */
  readonly statusCode: number | null;
  /** The URL that failed. */
  readonly url: string | null;
}

// ─── Parse errors ────────────────────────────────────────────────────────────

/**
 * The HTML from the source site did not match the expected structure.
 * This usually means the site layout changed or the URL was wrong.
 */
export class ParseError extends NovelDownloadError {
  constructor(
    message: string,
    options?: ErrorOptions & {
      readonly context?: Record<string, unknown>;
      readonly url?: string;
      readonly selector?: string;
    },
  ) {
    super(message, {
      ...options,
      context: { url: options?.url, selector: options?.selector, ...options?.context },
    });
    this.name = 'ParseError';
    this.url = options?.url ?? null;
    this.selector = options?.selector ?? null;
  }

  /** The URL that was being parsed when the error occurred. */
  readonly url: string | null;
  /** The CSS selector that failed to match (if applicable). */
  readonly selector: string | null;
}

// ─── Database errors ─────────────────────────────────────────────────────────

/** A database operation failed (connection, query, constraint, etc.). */
export class DatabaseError extends NovelDownloadError {
  constructor(
    message: string,
    options?: ErrorOptions & {
      readonly context?: Record<string, unknown>;
      readonly operation?: string;
    },
  ) {
    super(message, { ...options, context: { operation: options?.operation, ...options?.context } });
    this.name = 'DatabaseError';
    this.operation = options?.operation ?? null;
  }

  /** The name of the DB operation that failed (e.g. "insert", "select"). */
  readonly operation: string | null;
}

// ─── Not-found errors ────────────────────────────────────────────────────────

/** The requested resource (novel, chapter, etc.) was not found. */
export class NotFoundError extends NovelDownloadError {
  constructor(
    message: string,
    options?: ErrorOptions & {
      readonly context?: Record<string, unknown>;
      readonly resourceType?: string;
      readonly resourceId?: string;
    },
  ) {
    super(message, {
      ...options,
      context: {
        resourceType: options?.resourceType,
        resourceId: options?.resourceId,
        ...options?.context,
      },
    });
    this.name = 'NotFoundError';
    this.resourceType = options?.resourceType ?? null;
    this.resourceId = options?.resourceId ?? null;
  }

  /** Type of resource that was not found (e.g. "novel", "chapter"). */
  readonly resourceType: string | null;
  /** Identifier used in the lookup. */
  readonly resourceId: string | null;
}

// ─── Validation errors ───────────────────────────────────────────────────────

/** Input data failed validation. */
export class ValidationError extends NovelDownloadError {
  constructor(
    message: string,
    options?: ErrorOptions & {
      readonly context?: Record<string, unknown>;
      readonly field?: string;
      readonly value?: unknown;
    },
  ) {
    super(message, {
      ...options,
      context: { field: options?.field, value: options?.value, ...options?.context },
    });
    this.name = 'ValidationError';
    this.field = options?.field ?? null;
    this.value = options?.value;
  }

  /** The field that failed validation. */
  readonly field: string | null;
  /** The value that was rejected. */
  readonly value: unknown;
}

// ─── Utility type guard ──────────────────────────────────────────────────────

/** Returns `true` if `err` is a `NovelDownloadError` (or subclass). */
export function isNovelDownloadError(err: unknown): err is NovelDownloadError {
  return err instanceof NovelDownloadError;
}
