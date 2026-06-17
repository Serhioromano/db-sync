// ============================================================
// Test helpers for db-sync
// ============================================================

/**
 * Thrown when process.exit() is intercepted during tests.
 */
export class CapturedExit extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`);
    this.name = 'CapturedExit';
  }
}

/**
 * Replace process.exit with a throwing version, capture console output.
 * Returns a restore function.
 */
export function installMocks(): () => void {
  const originalExit = process.exit;
  const originalError = console.error;
  const originalLog = console.log;

  process.exit = ((code?: number) => {
    throw new CapturedExit(code ?? 0);
  }) as typeof process.exit;

  console.error = (...args: unknown[]) => {
    capture.stderr.push(args.map(String).join(' '));
  };

  console.log = (...args: unknown[]) => {
    capture.stdout.push(args.map(String).join(' '));
  };

  return () => {
    process.exit = originalExit;
    console.error = originalError;
    console.log = originalLog;
  };
}

// ---- Capture state (module-scoped) ----

let capture: { stdout: string[]; stderr: string[] } = {
  stdout: [],
  stderr: [],
};

export function resetCapture() {
  capture = { stdout: [], stderr: [] };
}

/**
 * Run a function that is expected to call process.exit(),
 * and return what was captured. If the function does not exit,
 * the test fails.
 */
export function runAndCaptureExit(
  fn: () => void
): { code: number; stdout: string[]; stderr: string[] } {
  resetCapture();
  try {
    fn();
    throw new Error('Expected process.exit() but function returned normally');
  } catch (e) {
    if (e instanceof CapturedExit) {
      return {
        code: e.code,
        stdout: [...capture.stdout],
        stderr: [...capture.stderr],
      };
    }
    throw e;
  }
}

/**
 * Run a function that is NOT expected to call process.exit().
 * Returns captured output.
 */
export function runWithoutExit(
  fn: () => void
): { stdout: string[]; stderr: string[] } {
  resetCapture();
  try {
    fn();
  } catch (e) {
    if (e instanceof CapturedExit) {
      throw new Error(
        `Unexpected process.exit(${e.code}). Output: ${capture.stderr.join('; ')}`
      );
    }
    throw e;
  }
  return {
    stdout: [...capture.stdout],
    stderr: [...capture.stderr],
  };
}
