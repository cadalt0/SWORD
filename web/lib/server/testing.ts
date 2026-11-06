import "server-only";

/// Testing logins are on unless TESTING_MODE is set to "false". Turn this off before any real users.
export function testingEnabled(): boolean {
  return process.env.TESTING_MODE !== "false";
}
