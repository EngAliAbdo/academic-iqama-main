export const SUPPORTED_PREFLIGHT_MODES = [
  "full",
  "repo",
  "cli",
  "start",
  "db",
  "frontend",
  "function",
  "serve",
  "deploy",
];

export function normalizePreflightMode(modeArgument) {
  if (!modeArgument) {
    return "full";
  }

  return SUPPORTED_PREFLIGHT_MODES.includes(modeArgument) ? modeArgument : null;
}
