// ============================================================
// Tests: src/utils/errors.ts
// ============================================================

import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { DbsError, EXIT_CODES } from '../src/utils/errors.js';
import { installMocks, runAndCaptureExit, resetCapture } from './helpers.js';

describe('DbsError', () => {
  let uninstall: () => void;

  beforeEach(() => {
    uninstall = installMocks();
    resetCapture();
  });

  afterEach(() => {
    uninstall();
  });

  // ---- Construction ----

  it('should create an error with required fields', () => {
    const err = new DbsError({
      code: 'CONNECT',
      message: 'Connection failed',
      cause: 'ECONNREFUSED',
    });

    expect(err.code).toBe('CONNECT');
    expect(err.message).toBe('Connection failed');
    expect(err.cause).toBe('ECONNREFUSED');
    expect(err.name).toBe('DbsError');
    expect(err).toBeInstanceOf(Error);
  });

  it('should create an error with all optional fields', () => {
    const err = new DbsError({
      code: 'MIGRATE',
      message: 'Alter failed',
      cause: 'syntax error',
      engine: 'mysql',
      dsn: 'mysql://localhost/db',
      hint: 'Check syntax',
      file: 'schema.dbml',
      line: 42,
      operation: 'ALTER TABLE',
      table: 'users',
      column: 'email',
    });

    expect(err.engine).toBe('mysql');
    expect(err.dsn).toBe('mysql://localhost/db');
    expect(err.hint).toBe('Check syntax');
    expect(err.file).toBe('schema.dbml');
    expect(err.line).toBe(42);
    expect(err.operation).toBe('ALTER TABLE');
    expect(err.table).toBe('users');
    expect(err.column).toBe('email');
  });

  // ---- exitCode ----

  it('should return correct exit code for each error category', () => {
    expect(EXIT_CODES.CONFIG).toBe(1);
    expect(EXIT_CODES.CONNECT).toBe(2);
    expect(EXIT_CODES.ENGINE).toBe(1);
    expect(EXIT_CODES.SCHEMA_READ).toBe(3);
    expect(EXIT_CODES.DBML_PARSE).toBe(3);
    expect(EXIT_CODES.DBML_WRITE).toBe(5);
    expect(EXIT_CODES.MIGRATE).toBe(4);
    expect(EXIT_CODES.TRANSACTION).toBe(4);
  });

  it('exitCode getter should map to EXIT_CODES', () => {
    const err = new DbsError({
      code: 'MIGRATE',
      message: 'x',
      cause: 'x',
    });
    expect(err.exitCode).toBe(4);
  });

  // ---- format() ----

  it('format() should include ERROR [CODE] and cause', () => {
    const err = new DbsError({
      code: 'CONFIG',
      message: 'Profiles file not found',
      cause: 'ENOENT',
    });

    const formatted = err.format();
    expect(formatted).toContain('ERROR [CONFIG] Profiles file not found');
    expect(formatted).toContain('cause: ENOENT');
  });

  it('format() should include optional fields when present', () => {
    const err = new DbsError({
      code: 'MIGRATE',
      message: 'Migration failed',
      cause: 'SQL error',
      engine: 'sqlite',
      dsn: './test.db',
      operation: 'ALTER TABLE',
      table: 'posts',
      column: 'title',
    });

    const formatted = err.format();
    expect(formatted).toContain('engine: sqlite');
    expect(formatted).toContain('dsn: ./test.db');
    expect(formatted).toContain('operation: ALTER TABLE');
    expect(formatted).toContain('table: posts');
    expect(formatted).toContain('column: title');
  });

  it('format() should omit optional fields when absent', () => {
    const err = new DbsError({
      code: 'CONFIG',
      message: 'No config',
      cause: 'missing profile',
    });

    const formatted = err.format();
    expect(formatted).not.toContain('engine:');
    expect(formatted).not.toContain('dsn:');
    expect(formatted).not.toContain('table:');
  });

  // ---- exit() ----

  it('exit() should call process.exit with correct code', async () => {
    const err = new DbsError({
      code: 'CONNECT',
      message: 'Connection refused',
      cause: 'ECONNREFUSED',
    });

    const captured = await runAndCaptureExit(() => err.exit());
    expect(captured.code).toBe(2);
    expect(captured.stderr.some((l) => l.includes('ERROR [CONNECT]'))).toBe(
      true
    );
    expect(captured.stderr.some((l) => l.includes('cause: ECONNREFUSED'))).toBe(
      true
    );
  });

  it('exit() should write formatted error to stderr', async () => {
    const err = new DbsError({
      code: 'SCHEMA_READ',
      message: 'Cannot read table',
      cause: 'table locked',
      table: 'users',
      hint: 'Try again',
    });

    const captured = await runAndCaptureExit(() => err.exit());
    // format() produces a single multi-line string; console.error receives it as one call
    expect(captured.stderr.length).toBe(1);
    const stderr = captured.stderr[0];
    expect(stderr).toContain('ERROR [SCHEMA_READ]');
    expect(stderr).toContain('table: users');
    expect(stderr).toContain('hint: Try again');
  });
});
