const BEARER_PREFIX = "Bearer ";

export function isAuthorized(authHeader, expectedToken) {
  if (!expectedToken) {
    return false;
  }
  if (typeof authHeader !== "string" || !authHeader.startsWith(BEARER_PREFIX)) {
    return false;
  }
  const providedToken = authHeader.slice(BEARER_PREFIX.length).trim();
  return providedToken.length > 0 && providedToken === expectedToken;
}
