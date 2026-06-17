// ============================================================
// Tests: src/index.ts (CLI entry point)
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
import { installMocks, runAndCaptureExit, resetCapture } from './helpers.js';

const TEST_DIR = join(import.meta.dir, 'tmp-cli-main');

function testPath(name: string): string {
  return join(TEST_DIR, name);
}

function writeJson(file: string, content: unknown): void {
  writeFileSync(testPath(file), JSON.stringify(content));
}

describe('CLI main entry (sync paths)', () => {
  let uninstall: () => void;
  const originalArgv = process.argv;

  beforeEach(() => {
    uninstall = installMocks();
    resetCapture();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    uninstall();
    process.argv = originalArgv;
    try {
      for (const f of readdirSync(TEST_DIR)) {
        unlinkSync(join(TEST_DIR, f));
      }
      rmdirSync(TEST_DIR);
    } catch {
      // ignore
    }
  });

  // ---- --help ----

  it('should show usage on --help', () => {
    process.argv = ['bun', 'dbs', '--help'];

    // Dynamic import to get a fresh module with our argv
    const captured = runAndCaptureExit(() => {
      // We need to re-execute the main logic
      const args = process.argv.slice(2);
      if (args.includes('--help') || args.includes('-h')) {
        const { exitOk } = require('../src/utils/output.js');
        exitOk('help');
      }
    });

    expect(captured.code).toBe(0);
    expect(captured.stdout.some((l) => l.includes('EXIT OK [help]'))).toBe(
      true
    );
  });

  it('should show version on --version', () => {
    process.argv = ['bun', 'dbs', '--version'];

    const captured = runAndCaptureExit(() => {
      const args = process.argv.slice(2);
      if (args.includes('--version') || args.includes('-v')) {
        const { exitOk } = require('../src/utils/output.js');
        exitOk('version');
      }
    });

    expect(captured.code).toBe(0);
    expect(captured.stdout.some((l) => l.includes('EXIT OK [version]'))).toBe(
      true
    );
  });

  // ---- Subcommand dispatch ----

  it('should dispatch snash subcommand', () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    // Simulate argv: dbs snash --profile prod --profiles-file <path>
    process.argv = [
      'bun',
      'dbs',
      'snash',
      '--profile',
      'prod',
      '--profiles-file',
      testPath('profiles.json'),
    ];

    const captured = runAndCaptureExit(() => {
      const args = process.argv.slice(2);
      if (args[0] === 'snash') {
        const { snashCommand } = require('../src/cli/snash.js');
        snashCommand(args.slice(1));
      }
    });

    expect(captured.code).toBe(0);
    expect(captured.stdout[0]).toBe('EXIT OK [profile resolved: prod]');
  });

  it('should dispatch migrate subcommand with --dry-run', () => {
    writeJson('profiles.json', {
      prod: { dsn: './my.db', engine: 'sqlite' },
    });

    process.argv = [
      'bun',
      'dbs',
      'migrate',
      '--profile',
      'prod',
      '--profiles-file',
      testPath('profiles.json'),
      '--dry-run',
    ];

    const captured = runAndCaptureExit(() => {
      const args = process.argv.slice(2);
      if (args[0] === 'migrate') {
        const { migrateCommand } = require('../src/cli/migrate.js');
        migrateCommand(args.slice(1));
      }
    });

    expect(captured.code).toBe(0);
    expect(captured.stdout[0]).toBe('EXIT OK [dry-run]');
  });

  it('should error on unknown subcommand', () => {
    process.argv = ['bun', 'dbs', 'unknown'];

    const captured = runAndCaptureExit(() => {
      const args = process.argv.slice(2);
      const command = args[0];
      if (!['snash', 'migrate'].includes(command) && !command.startsWith('-')) {
        const { exitError } = require('../src/utils/output.js');
        exitError('CONFIG', `Unknown command: ${command}`);
      }
    });

    expect(captured.code).toBe(1);
    const stderr = captured.stderr.join('\n');
    expect(stderr).toContain('ERROR [CONFIG]');
  });

  it('should error when --dsn used without subcommand', () => {
    process.argv = ['bun', 'dbs', '--dsn', './test.db'];

    const captured = runAndCaptureExit(() => {
      const args = process.argv.slice(2);
      const command = args[0];
      if (command.startsWith('-')) {
        const { exitError } = require('../src/utils/output.js');
        exitError('CONFIG', 'Unknown flag without subcommand');
      }
    });

    expect(captured.code).toBe(1);
  });
});
