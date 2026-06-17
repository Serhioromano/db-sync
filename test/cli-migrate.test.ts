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

  it('should error when no args provided', () => {
    const captured = runAndCaptureExit(() => migrateCommand([]));

    expect(captured.code).toBe(1);
    const stderr = captured.stderr.join('\n');
    expect(stderr).toContain('ERROR [CONFIG]');
    expect(stderr).toContain('No profile or --dsn provided');
  });

  // ---- PROFILE ----

  it('should resolve --profile and exit OK (migrate mode)', () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
      ])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout[0]).toBe('EXIT OK [migrate]');
  });

  // ---- DRY-RUN ----

  it('should show dry-run mode', () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
        '--dry-run',
      ])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout[0]).toBe('EXIT OK [dry-run]');
  });

  it('should show dry-run via --dry-run flag (boolean style)', () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
        '--dry-run',
      ])
    );

    expect(captured.stdout[0]).toBe('EXIT OK [dry-run]');
  });

  // ---- INSERT ----

  it('should show with-insert when --insert flag is set', () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = runAndCaptureExit(() =>
      migrateCommand([
        '--profile',
        'prod',
        '--profiles-file',
        testPath('profiles.json'),
        '--insert',
      ])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout[0]).toBe('EXIT OK [migrate [with-insert]]');
  });

  it('should combine dry-run and insert', () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = runAndCaptureExit(() =>
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
    expect(captured.stdout[0]).toBe('EXIT OK [dry-run [with-insert]]');
  });

  // ---- DSN + ENGINE ----

  it('should accept --dsn and --engine directly', () => {
    const captured = runAndCaptureExit(() =>
      migrateCommand(['--dsn', './test.db', '--engine', 'sqlite'])
    );

    expect(captured.code).toBe(0);
    expect(captured.stdout[0]).toContain('engine=sqlite');
    expect(captured.stdout[0]).toContain('dsn=./test.db');
  });

  it('should show migrate mode with --dsn --engine', () => {
    const captured = runAndCaptureExit(() =>
      migrateCommand(['--dsn', './test.db', '--engine', 'sqlite'])
    );

    expect(captured.stdout[0]).toContain('migrate:');
  });

  it('should show dry-run mode with --dsn --engine --dry-run', () => {
    const captured = runAndCaptureExit(() =>
      migrateCommand([
        '--dsn',
        './test.db',
        '--engine',
        'sqlite',
        '--dry-run',
      ])
    );

    expect(captured.stdout[0]).toContain('dry-run:');
  });

  // ---- ENGINE validation ----

  it('should error on unsupported engine', () => {
    const captured = runAndCaptureExit(() =>
      migrateCommand(['--dsn', 'x', '--engine', 'couchdb'])
    );

    expect(captured.code).toBe(1);
    const stderr = captured.stderr.join('\n');
    expect(stderr).toContain('ERROR [ENGINE]');
    expect(stderr).toContain('Unsupported engine');
  });

  // ---- PROFILE priority ----

  it('should prefer --profile over --dsn+engine', () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    const captured = runAndCaptureExit(() =>
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
    expect(captured.stdout[0]).toBe('EXIT OK [migrate]');
  });
});
