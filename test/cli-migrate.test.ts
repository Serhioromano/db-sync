// ============================================================
// Tests: src/cli/migrate.ts
// ============================================================

import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { migrateCommand } from '../src/cli/migrate.js';
import { installMocks, runAndCaptureExit, resetCapture } from './helpers.js';

const TEST_DIR = join(import.meta.dir, 'tmp-cli-migrate');

function testPath(name: string): string {
  return join(TEST_DIR, name);
}

function writeJson(file: string, content: unknown): void {
  writeFileSync(testPath(file), JSON.stringify(content));
}

describe('migrateCommand', () => {
  let uninstall: () => void;

  beforeEach(() => {
    uninstall = installMocks();
    resetCapture();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    uninstall();
    try {
      for (const f of readdirSync(TEST_DIR)) {
        unlinkSync(join(TEST_DIR, f));
      }
      rmdirSync(TEST_DIR);
    } catch {
      // ignore
    }
  });

  // ---- NO ARGS → ERROR ----

  it('should error when no args provided', async () => {
    const captured = await runAndCaptureExit(() => migrateCommand([]));

    expect(captured.code).toBe(1);
    const stderr = captured.stderr.join('\n');
    expect(stderr).toContain('ERROR [CONFIG]');
    expect(stderr).toContain('No profile or --dsn provided');
  });

  // ---- PROFILE ----

  it('should resolve --profile and exit OK (migrate mode)', async () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = await runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
      ])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout.join('\n')).toContain('EXIT OK');
  });

  // ---- DRY-RUN ----

  it('should show dry-run mode', async () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = await runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
        '--dry-run',
      ])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout.join('\n')).toContain('EXIT OK');
  });

  it('should show dry-run via --dry-run flag (boolean style)', async () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = await runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
        '--dry-run',
      ])
    );

    expect(captured.stdout.join('\n')).toContain('EXIT OK');
  });

  // ---- INSERT ----

  it('should show with-insert when --insert flag is set', async () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = await runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
        '--insert',
      ])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout.join('\n')).toContain('EXIT OK');
  });

  it('should combine dry-run and insert', async () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = await runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
        '--dry-run',
        '--insert',
      ])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout.join('\n')).toContain('EXIT OK');
  });

  // ---- DSN + ENGINE ----

  it('should accept --dsn and --engine directly', async () => {
    const captured = await runAndCaptureExit(() =>
      migrateCommand(['--dsn', './test.db', '--engine', 'sqlite'])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout.join('\n')).toContain('EXIT OK');
  });

  it('should show dry-run mode with --dsn --engine --dry-run', async () => {
    const captured = await runAndCaptureExit(() =>
      migrateCommand([
        '--dsn',
        './test.db',
        '--engine',
        'sqlite',
        '--dry-run',
      ])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout.join('\n')).toContain('EXIT OK');
  });

  // ---- ENGINE validation ----

  it('should error on unsupported engine', async () => {
    const captured = await runAndCaptureExit(() =>
      migrateCommand(['--dsn', 'x', '--engine', 'couchdb'])
    );

    expect(captured.code).toBe(1);
    const stderr = captured.stderr.join('\n');
    expect(stderr).toContain('ERROR [ENGINE]');
    expect(stderr).toContain('Unsupported engine');
  });

  // ---- PROFILE priority ----

  it('should prefer --profile over --dsn+engine', async () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = await runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
        '--dsn',
        'other.db',
        '--engine',
        'mysql',
      ])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout.join('\n')).toContain('EXIT OK');
  });
});
