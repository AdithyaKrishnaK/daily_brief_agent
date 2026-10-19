import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../src/web/api';
afterEach(() => vi.unstubAllGlobals());
it('reads exported dashboard data without a service and blocks changes', async () => {
 const snapshot = { edition: { overview: 'Collected reporting' } };
 vi.stubGlobal('window', { __BRIEF_SNAPSHOT__: snapshot });
 vi.stubGlobal('fetch', () => { throw new Error('An export must not make API requests'); });
 expect(await api('/dashboard')).toEqual(snapshot);
 await expect(api('/feedback', 'POST', {})).rejects.toThrow('read-only');
});
