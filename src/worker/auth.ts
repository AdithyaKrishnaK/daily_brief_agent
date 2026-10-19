import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppError } from '../shared/contracts';
export interface AuthEnv { ACCESS_TEAM_DOMAIN: string; ACCESS_AUD: string; OWNER_EMAIL: string }
const jwks = new Map<string, JWTVerifyGetKey>();
export async function authenticate(request: Request, env: AuthEnv, keys?: JWTVerifyGetKey) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.OWNER_EMAIL) throw new AppError(401, 'login_required', 'Sign in to open your brief.');
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  if (!keys) { if (!jwks.has(issuer)) jwks.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))); keys = jwks.get(issuer)!; }
  try {
    const { payload } = await jwtVerify(token, keys, { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'email'] });
    if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) throw new Error('Wrong identity');
    return { email: payload.email, id: 'owner' };
  } catch { throw new AppError(401, 'login_required', 'Sign in with the owner account.'); }
}
export function assertMutationOrigin(request: Request, allowedOrigin: string) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('Origin') !== allowedOrigin) throw new AppError(403, 'invalid_origin', 'This request came from another site.');
}
