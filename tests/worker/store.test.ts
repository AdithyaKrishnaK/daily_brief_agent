import { expect, it } from 'vitest';
import { BriefStore } from '../../src/worker/store';
import { database } from '../helpers';
it('starts without an interest questionnaire and persists source/schedule changes', () => {
  const db = database(); const store = new BriefStore(db);
  expect(store.getSettings().sources).toHaveLength(4);
  expect(store.getSettings()).toMatchObject({ timeZone: 'Asia/Kolkata', deliveryTime: '06:00', collectionLeadMinutes: 30 });
  store.saveSettings({ ...store.getSettings(), deliveryTime: '07:00' });
  expect(new BriefStore(db).getSettings().deliveryTime).toBe('07:00');
  expect(new BriefStore(db).getDashboard().profile.follows).toEqual([]);
});
