// ============================================================
// Tests: src/config/profiles.ts
// ============================================================

import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { unlinkSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadProfilesFile, resolveProfile, extractDbName, defaultDbmlPath, discoverProfilesFile, saveProfile } from '../src/config/profiles.js';
import { installMocks, runAndCaptureExit, resetCapture } from './helpers.js';

const TEST_DIR = join(import.meta.dir, 'tmp-profiles');

function testPath(name: string): string {
  return join(TEST_DIR, name);
}

function writeJson(file: string, content: unknown): void {
  writeFileSync(testPath(file), JSON.stringify(content));
}

describe('profiles', () => {
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
    // Clean up test files
    try {
      for (const f of readdirSync(TEST_DIR)) {
        unlinkSync(join(TEST_DIR, f));
      }
      rmdirSync(TEST_DIR);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadProfilesFile', () => {
    it('should exit with CONFIG error if file does not exist', async () => {
      const captured = await runAndCaptureExit(() =>
        loadProfilesFile(testPath('nonexistent.json'))
      );
      expect(captured.code).toBe(1);
      const stderr = captured.stderr.join('\n');
      expect(stderr).toContain('ERROR [CONFIG]');
      expect(stderr).toContain('not found');
    });

    it('should exit with CONFIG error if file is empty', async () => {
      writeFileSync(testPath('empty.json'), '');
      const captured = await runAndCaptureExit(() =>
        loadProfilesFile(testPath('empty.json'))
      );
      expect(captured.code).toBe(1);
      const stderr = captured.stderr.join('\n');
      expect(stderr).toContain('is empty');
    });

    it('should exit with CONFIG error if file is not valid JSON', async () => {
      writeFileSync(testPath('invalid.json'), '{bad json');
      const captured = await runAndCaptureExit(() =>
        loadProfilesFile(testPath('invalid.json'))
      );
      expect(captured.code).toBe(1);
      const stderr = captured.stderr.join('\n');
      expect(stderr).toContain('Invalid JSON');
    });

    it('should exit with CONFIG error if JSON is an array', async () => {
      writeFileSync(testPath('array.json'), '[1,2,3]');
      const captured = await runAndCaptureExit(() =>
        loadProfilesFile(testPath('array.json'))
      );
      expect(captured.code).toBe(1);
      const stderr = captured.stderr.join('\n');
      expect(stderr).toContain('must contain a JSON object');
    });

    it('should load a valid profiles file', () => {
      // loadProfilesFile doesn't call exit on success
      writeJson('valid.json', {
        prod: { dsn: './db.sqlite', engine: 'sqlite' },
      });
      // This should NOT throw CapturedExit
      const profiles = loadProfilesFile(testPath('valid.json'));
      expect(profiles.prod.dsn).toBe('./db.sqlite');
      expect(profiles.prod.engine).toBe('sqlite');
    });
  });

  describe('discoverProfilesFile', () => {
    it('should return explicit path when provided', () => {
      // Explicit path is returned as-is (loadProfilesFile handles existence check)
      const result = discoverProfilesFile('/explicit/path/.dbs.json');
      expect(result).toBe('/explicit/path/.dbs.json');
    });

    it('should return explicit path even if file does not exist', () => {
      // Discovery only searches when no explicit path; explicit path is returned verbatim
      const result = discoverProfilesFile('nonexistent.json');
      expect(result).toBe('nonexistent.json');
    });

    it('should discover migration/.dbs.json when it exists', () => {
      // The file exists in the project (we moved it there earlier)
      // This test runs from the project root CWD
      const result = discoverProfilesFile();
      expect(result).toBe('migration/.dbs.json');
    });

    it('should discover .dbs.json when migration/ one does not exist', () => {
      // Temporarily rename migration/.dbs.json out of the way
      const { renameSync } = require('node:fs');
      const rootDotDbs = '.dbs.json';
      const migDotDbs = 'migration/.dbs.json';

      // Create .dbs.json in root (overriding migration one for discovery priority)
      writeFileSync('.dbs.json', JSON.stringify({ test: { dsn: './x.db', engine: 'sqlite' } }));
      // Hide migration/.dbs.json temporarily
      renameSync(migDotDbs, 'migration/.dbs.json.bak');

      try {
        const result = discoverProfilesFile();
        expect(result).toBe('.dbs.json');
      } finally {
        // Restore
        renameSync('migration/.dbs.json.bak', migDotDbs);
        unlinkSync('.dbs.json');
      }
    });

    it('should error when no profiles file found', async () => {
      // Temporarily hide both files
      const { renameSync } = require('node:fs');
      const migDotDbs = 'migration/.dbs.json';
      renameSync(migDotDbs, 'migration/.dbs.json.bak');

      try {
        const captured = await runAndCaptureExit(() => discoverProfilesFile());
        expect(captured.code).toBe(1);
        const stderr = captured.stderr.join('\n');
        expect(stderr).toContain('ERROR [CONFIG]');
        expect(stderr).toContain('Profiles file not found');
        expect(stderr).toContain('migration/.dbs.json');
      } finally {
        renameSync('migration/.dbs.json.bak', migDotDbs);
      }
    });
  });

  describe('resolveProfile', () => {
    it('should exit with CONFIG if profile not found', async () => {
      writeJson('profiles.json', {
        prod: { dsn: './db.sqlite', engine: 'sqlite' },
      });
      const captured = await runAndCaptureExit(() =>
        resolveProfile('staging', testPath('profiles.json'))
      );
      expect(captured.code).toBe(1);
      const stderr = captured.stderr.join('\n');
      expect(stderr).toContain('Profile "staging" not found');
      expect(stderr).toContain('Available profiles: prod');
    });

    it('should exit with CONFIG if profile missing dsn', async () => {
      writeJson('profiles.json', {
        bad: { engine: 'sqlite' },
      });
      const captured = await runAndCaptureExit(() =>
        resolveProfile('bad', testPath('profiles.json'))
      );
      expect(captured.code).toBe(1);
      const stderr = captured.stderr.join('\n');
      expect(stderr).toContain('missing required field: dsn');
    });

    it('should exit with CONFIG if profile missing engine', async () => {
      writeJson('profiles.json', {
        bad: { dsn: './db.sqlite' },
      });
      const captured = await runAndCaptureExit(() =>
        resolveProfile('bad', testPath('profiles.json'))
      );
      expect(captured.code).toBe(1);
      const stderr = captured.stderr.join('\n');
      expect(stderr).toContain('missing required field: engine');
    });

    it('should exit with ENGINE if unsupported engine', async () => {
      writeJson('profiles.json', {
        bad: { dsn: 'xxx', engine: 'oracle' },
      });
      const captured = await runAndCaptureExit(() =>
        resolveProfile('bad', testPath('profiles.json'))
      );
      expect(captured.code).toBe(1);
      const stderr = captured.stderr.join('\n');
      expect(stderr).toContain('ERROR [ENGINE]');
      expect(stderr).toContain('Unsupported engine');
    });

    it('should resolve a valid profile into DbsConfig', () => {
      writeJson('profiles.json', {
        prod: { dsn: './my.db', engine: 'SQLITE', prefix: 'app_' },
      });
      // Should not exit
      const config = resolveProfile('prod', testPath('profiles.json'));
      expect(config.engine).toBe('sqlite');
      expect(config.dsn).toBe('./my.db');
      expect(config.prefix).toBe('app_');
      expect(config.file).toBe('./migration/my.dbml'); // derived from DSN
      expect(config.profile).toBe('prod');
      expect(config.profilesFile).toContain('profiles.json');
    });

    it('should default prefix to empty string', () => {
      writeJson('profiles.json', {
        prod: { dsn: './db.sqlite', engine: 'sqlite' },
      });
      const config = resolveProfile('prod', testPath('profiles.json'));
      expect(config.prefix).toBe('');
    });

    it('should say "No profiles defined" when file has no profiles', async () => {
      writeJson('profiles.json', {});
      const captured = await runAndCaptureExit(() =>
        resolveProfile('any', testPath('profiles.json'))
      );
      const stderr = captured.stderr.join('\n');
      expect(stderr).toContain('No profiles defined');
    });

    // ---- file resolution ----

    it('should use explicit file from profile', () => {
      writeJson('profiles.json', {
        prod: { dsn: './my.db', engine: 'sqlite', file: './custom/schema.dbml' },
      });
      const config = resolveProfile('prod', testPath('profiles.json'));
      expect(config.file).toBe('./custom/schema.dbml');
    });

    it('should derive file from SQLite DSN when not specified', () => {
      writeJson('profiles.json', {
        prod: { dsn: './data/myapp.db', engine: 'sqlite' },
      });
      const config = resolveProfile('prod', testPath('profiles.json'));
      expect(config.file).toBe('./migration/myapp.dbml');
    });
  });
});

// ============================================================
// Tests: saveProfile
// ============================================================

describe('saveProfile', () => {
  it('should create a new profiles file with one profile', () => {
    const filePath = testPath('save-new.json');
    saveProfile(filePath, 'dev', {
      dsn: './test.db',
      engine: 'sqlite',
      file: './migration/dev.dbml',
    });

    const profiles = loadProfilesFile(filePath);
    expect(profiles.dev.dsn).toBe('./test.db');
    expect(profiles.dev.engine).toBe('sqlite');
    expect(profiles.dev.file).toBe('./migration/dev.dbml');
  });

  it('should add a profile to an existing file without removing others', () => {
    const filePath = testPath('save-merge.json');
    // Pre-create with one profile
    writeJson('save-merge.json', {
      prod: { dsn: './prod.db', engine: 'sqlite' },
    });

    saveProfile(filePath, 'staging', {
      dsn: './staging.db',
      engine: 'sqlite',
    });

    const profiles = loadProfilesFile(filePath);
    expect(profiles.prod.dsn).toBe('./prod.db');
    expect(profiles.staging.dsn).toBe('./staging.db');
  });

  it('should overwrite an existing profile with the same name', () => {
    const filePath = testPath('save-overwrite.json');
    writeJson('save-overwrite.json', {
      prod: { dsn: './old.db', engine: 'sqlite' },
    });

    saveProfile(filePath, 'prod', {
      dsn: './new.db',
      engine: 'sqlite',
    });

    const profiles = loadProfilesFile(filePath);
    expect(profiles.prod.dsn).toBe('./new.db');
  });

  it('should create parent directories if needed', () => {
    const filePath = testPath('nested/subdir/profiles.json');
    saveProfile(filePath, 'deep', {
      dsn: './deep.db',
      engine: 'sqlite',
    });

    expect(existsSync(filePath)).toBe(true);
    const profiles = loadProfilesFile(filePath);
    expect(profiles.deep.dsn).toBe('./deep.db');
  });

  it('should handle empty prefix', () => {
    const filePath = testPath('save-no-prefix.json');
    saveProfile(filePath, 'noprefix', {
      dsn: './db.sqlite',
      engine: 'sqlite',
      prefix: '',
    });

    const profiles = loadProfilesFile(filePath);
    // Empty prefix should not be written to the file
    expect(profiles.noprefix.prefix).toBeUndefined();
  });
});

// ============================================================
// Tests: extractDbName and defaultDbmlPath
// ============================================================

describe('extractDbName', () => {
  // --- SQLite ---

  it('should extract name from .db file', () => {
    expect(extractDbName('./data/myapp.db', 'sqlite')).toBe('myapp');
  });

  it('should extract name from .sqlite file', () => {
    expect(extractDbName('/var/db/production.sqlite', 'sqlite')).toBe('production');
  });

  it('should extract name from .sqlite3 file', () => {
    expect(extractDbName('local/db.sqlite3', 'sqlite')).toBe('db');
  });

  it('should extract name from path without known extension', () => {
    expect(extractDbName('./data/custom.ext', 'sqlite')).toBe('custom');
  });

  it('should handle path with no extension', () => {
    expect(extractDbName('./data/rawfile', 'sqlite')).toBe('rawfile');
  });

  it('should handle just a filename', () => {
    expect(extractDbName('mydb.sqlite', 'sqlite')).toBe('mydb');
  });

  // --- MySQL / PostgreSQL ---

  it('should extract name from MySQL DSN', () => {
    expect(extractDbName('mysql://user:pass@host:3306/mydb', 'mysql')).toBe('mydb');
  });

  it('should extract name from PostgreSQL DSN', () => {
    expect(extractDbName('postgresql://user:pass@host:5432/myapp', 'postgres')).toBe('myapp');
  });

  it('should handle DSN without port', () => {
    expect(extractDbName('mysql://user@host/mydb', 'mysql')).toBe('mydb');
  });

  it('should strip query parameters from DSN', () => {
    expect(extractDbName('mysql://user:pass@host:3306/mydb?ssl=true', 'mysql')).toBe('mydb');
  });

  it('should return fallback for unparseable DSN', () => {
    expect(extractDbName('weird-string', 'mysql')).toBe('database');
  });
});

describe('defaultDbmlPath', () => {
  it('should build path from SQLite DSN', () => {
    expect(defaultDbmlPath('./data/myapp.db', 'sqlite')).toBe('./migration/myapp.dbml');
  });

  it('should build path from MySQL DSN', () => {
    expect(defaultDbmlPath('mysql://user@host/mydb', 'mysql')).toBe('./migration/mydb.dbml');
  });
});
