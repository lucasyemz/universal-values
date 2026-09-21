import { it,expect } from 'vitest';
import { legacySiteDestination } from './legacy-section';
it('preserves old Designer and site bookmarks without accepting arbitrary destinations',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  expect(legacySiteDestination('site','#'+id,'static')).toBe('/dashboard/sites/site/changes/'+id);
  expect(legacySiteDestination('site','#managed-values','scans')).toBe('/dashboard/sites/site/managed-values');
  expect(legacySiteDestination('site','#new-scan','scans')).toBe('/dashboard/sites/site/scans/new');
  expect(legacySiteDestination('site','#history','static')).toBe('/dashboard/sites/site/changes?filter=static');
  expect(legacySiteDestination('site','#https://example.com','static')).toBeNull();
});
