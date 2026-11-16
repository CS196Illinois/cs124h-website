/**
 * The web developer sandbox has been removed, and its database table and
 * column were dropped (scripts/purge-web-team.sql). No role is sandboxed,
 * so the sandbox branches still present in some routes never run. These
 * stand-ins keep those imports working until the routes are rewritten.
 */

export const isSandboxRole = () => false;
export const getSandboxMode = async () => "off";
export const resetSandbox = async () => {};

function removed() {
  throw new Error("The web developer sandbox has been removed.");
}
export const mergeSandboxRows = removed;
export const getEffectiveRow = removed;
export const sandboxWrite = removed;
