// ============================================================
// Tests: src/utils/output.ts
// ============================================================

import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { exitOk, exitError, warn } from '../src/utils/output.js';
import { installMocks, runAndCaptureExit, runWithoutExit, resetCapture } from './helpers.js';

describe('exitOk', () => {
  let uninstall: () => void;

  beforeEach(() => {
    uninstall = installMocks();
    resetCapture();
  });

  afterEach(() => {
    uninstall();
  });

  it('should print EXIT OK [details] and exit with code 0', async () => {
    const captured = await runAndCaptureExit(() => exitOk('profile resolved: prod'));

    expect(captured.code).toBe(0);
    expect(captured.stdout.length).toBe(1);
    expect(captured.stdout[0]).toBe('EXIT OK [profile resolved: prod]');
    expect(captured.stderr.length).toBe(0);
  });

  it('should exit with code 0 for empty details', async () => {
    const captured = await runAndCaptureExit(() => exitOk(''));

    expect(captured.code).toBe(0);
    expect(captured.stdout[0]).toBe('EXIT OK []');
  });

  it('should exit with code 0 for multi-word details', async () => {
    const captured = await runAndCaptureExit(() => exitOk('dry-run: 5 operations previewed'));

    expect(captured.code).toBe(0);
    expect(captured.stdout[0]).toBe('EXIT OK [dry-run: 5 operations previewed]');
  });
});

describe('exitError', () => {
  let uninstall: () => void;

  beforeEach(() => {
    uninstall = installMocks();
    resetCapture();
  });

  afterEach(() => {
    uninstall();
  });

  it('should print ERROR [CODE] and exit with matching code', async () => {
    const captured = await runAndCaptureExit(() =>
      exitError('CONFIG', 'No profile provided', {
        hint: 'Use --profile',
      })
    );

    expect(captured.code).toBe(1);
    expect(captured.stdout.length).toBe(0);
    const stderr = captured.stderr.join('\n');
    expect(stderr).toContain('ERROR [CONFIG] No profile provided');
    expect(stderr).toContain('hint: Use --profile');
  });

  it('should include optional context fields', async () => {
    const captured = await runAndCaptureExit(() =>
      exitError('MIGRATE', 'Column not found', {
        engine: 'sqlite',
        operation: 'ALTER TABLE',
        table: 'users',
        column: 'email',
        cause: 'column does not exist',
      })
    );

    expect(captured.code).toBe(4);
    const stderr = captured.stderr.join('\n');
    expect(stderr).toContain('engine: sqlite');
    expect(stderr).toContain('operation: ALTER TABLE');
    expect(stderr).toContain('table: users');
    expect(stderr).toContain('column: email');
  });

  it('should use message as cause when cause is not provided', async () => {
    const captured = await runAndCaptureExit(() =>
      exitError('CONNECT', 'Connection refused', {})
    );

    const stderr = captured.stderr.join('\n');
    expect(stderr).toContain('cause: Connection refused');
  });

  it('should omit fields that are not provided', async () => {
    const captured = await runAndCaptureExit(() =>
      exitError('SCHEMA_READ', 'Read error', { cause: 'locked' })
    );

    const stderr = captured.stderr.join('\n');
    expect(stderr).not.toContain('engine:');
    expect(stderr).not.toContain('table:');
    expect(stderr).not.toContain('file:');
  });

  it('should exit with code 5 for DBML_WRITE', async () => {
    const captured = await runAndCaptureExit(() =>
      exitError('DBML_WRITE', 'Cannot write file', {
        file: 'schema.dbml',
      })
    );

    expect(captured.code).toBe(5);
    const stderr = captured.stderr.join('\n');
    expect(stderr).toContain('ERROR [DBML_WRITE]');
    expect(stderr).toContain('file: schema.dbml');
  });
});

describe('warn', () => {
  let uninstall: () => void;

  beforeEach(() => {
    uninstall = installMocks();
    resetCapture();
  });

  afterEach(() => {
    uninstall();
  });

  it('should print WARN to stderr without exiting', async () => {
    const output = await runWithoutExit(() => warn('DEPRECATED', 'Old flag used'));

    expect(output.stderr.length).toBe(1);
    expect(output.stderr[0]).toBe('WARN [DEPRECATED] Old flag used');
    expect(output.stdout.length).toBe(0);
  });

  it('should not call process.exit', () => {
    // if warn called exit, runWithoutExit would throw
    expect(() => warn('INFO', 'Some warning')).not.toThrow();
  });
});
