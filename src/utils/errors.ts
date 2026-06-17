// ============================================================
// Structured error types for db-sync
// ============================================================

/**
 * All recognised error codes for db-sync.
 */
export type DbsErrorCode =
  | 'CONFIG' // .dbs.json not found, invalid JSON, missing profile
  | 'CONNECT' // Failed to connect to DB (DSN, port, host, credentials)
  | 'ENGINE' // Unsupported --engine, no adapter available
  | 'SCHEMA_READ' // Error extracting tables/columns/indexes from DB
  | 'DBML_PARSE' // Syntax error in DBML file
  | 'DBML_WRITE' // Error writing output DBML file
  | 'MIGRATE' // Error executing SQL (specific operation + statement)
  | 'TRANSACTION'; // Error during commit/rollback

/**
 * Exit codes per error category (for CI and AI agents).
 */
export const EXIT_CODES: Record<DbsErrorCode, number> = {
  CONFIG: 1,
  CONNECT: 2,
  ENGINE: 1, // Config-level error
  SCHEMA_READ: 3,
  DBML_PARSE: 3,
  DBML_WRITE: 5,
  MIGRATE: 4,
  TRANSACTION: 4,
};

/**
 * Structured error for db-sync.
 *
 * Always has: code, message, cause.
 * Optionally: engine, dsn, hint, file, line, operation, table, column.
 */
export class DbsError extends Error {
  /** Error category code (CONFIG, CONNECT, ENGINE, etc.) */
  readonly code: DbsErrorCode;

  /** Underlying cause / technical reason */
  readonly cause: string;

  // --- Optional context fields ---

  /** Database engine (sqlite, mysql, postgres) */
  readonly engine?: string;

  /** Data Source Name (connection string, may be partially redacted) */
  readonly dsn?: string;

  /** Human-readable hint for the user */
  readonly hint?: string;

  /** File path related to the error (DBML file, profiles file) */
  readonly file?: string;

  /** Line number in the file */
  readonly line?: number;

  /** SQL operation that caused the error */
  readonly operation?: string;

  /** Table name related to the error */
  readonly table?: string;

  /** Column name related to the error */
  readonly column?: string;

  constructor(params: {
    code: DbsErrorCode;
    message: string;
    cause: string;
    engine?: string;
    dsn?: string;
    hint?: string;
    file?: string;
    line?: number;
    operation?: string;
    table?: string;
    column?: string;
  }) {
    super(params.message);
    this.name = 'DbsError';
    this.code = params.code;
    this.cause = params.cause;
    this.engine = params.engine;
    this.dsn = params.dsn;
    this.hint = params.hint;
    this.file = params.file;
    this.line = params.line;
    this.operation = params.operation;
    this.table = params.table;
    this.column = params.column;
  }

  /**
   * Returns the exit code for this error's category.
   */
  get exitCode(): number {
    return EXIT_CODES[this.code];
  }

  /**
   * Format the error for stderr output (AI-friendly structured format).
   * Follows the specification in SPEC.md §4.4.
   */
  format(): string {
    const lines: string[] = [];

    lines.push(`ERROR [${this.code}] ${this.message}`);

    if (this.engine) lines.push(`  engine: ${this.engine}`);
    if (this.dsn) lines.push(`  dsn: ${this.dsn}`);
    if (this.file) lines.push(`  file: ${this.file}`);
    if (this.line !== undefined) lines.push(`  line: ${this.line}`);
    if (this.operation) lines.push(`  operation: ${this.operation}`);
    if (this.table) lines.push(`  table: ${this.table}`);
    if (this.column) lines.push(`  column: ${this.column}`);
    lines.push(`  cause: ${this.cause}`);
    if (this.hint) lines.push(`  hint: ${this.hint}`);

    return lines.join('\n');
  }

  /**
   * Write formatted error to stderr and exit with the matching exit code.
   */
  exit(): never {
    console.error(this.format());
    process.exit(this.exitCode);
  }
}
