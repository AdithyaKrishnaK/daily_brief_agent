import { describe, expect, it } from 'vitest';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { authenticate, assertMutationOrigin } from '../../src/worker/auth';
describe('owner access', () => {
  it('rejects missing, expired, forged and other-owner identities but accepts returning owner', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test' }] });
    const env = { ACCESS_TEAM_DOMAIN: 'paper.cloudflareaccess.com', ACCESS_AUD: 'paper', OWNER_EMAIL: 'owner@example.com' };
    const token = (email: string, aud = 'paper', expires: string | number = '1h') => new SignJWT({ email }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://paper.cloudflareaccess.com').setAudience(aud).setExpirationTime(expires).sign(privateKey);
    const request = (jwt: string) => new Request('https://brief.example/api/dashboard', { headers: { 'Cf-Access-Jwt-Assertion': jwt } });
    await expect(authenticate(request(''), env, keys)).rejects.toThrow();
    await expect(authenticate(request(await token('other@example.com')), env, keys)).rejects.toThrow();
    await expect(authenticate(request(await token('owner@example.com', 'wrong')), env, keys)).rejects.toThrow();
    await expect(authenticate(request(await token('owner@example.com', 'paper', 1577836800)), env, keys)).rejects.toThrow();
    await expect(authenticate(request('forged.token.value'), env, keys)).rejects.toThrow();
    const valid = request(await token('owner@example.com'));
    expect((await authenticate(valid, env, keys)).email).toBe('owner@example.com');
    expect((await authenticate(valid, env, keys)).email).toBe('owner@example.com');
  });
  it('blocks absent or foreign origins on writes', () => {
    expect(() => assertMutationOrigin(new Request('https://brief.example/api', { method: 'POST' }), 'https://brief.example')).toThrow();
    expect(() => assertMutationOrigin(new Request('https://brief.example/api', { method: 'POST', headers: { Origin: 'https://evil.example' } }), 'https://brief.example')).toThrow();
    expect(() => assertMutationOrigin(new Request('https://brief.example/api', { method: 'POST', headers: { Origin: 'https://brief.example' } }), 'https://brief.example')).not.toThrow();
  });
});
