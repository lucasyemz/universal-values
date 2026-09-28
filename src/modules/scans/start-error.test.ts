import {expect,it} from 'vitest';
import {scanStartError} from './start-error';
it('identifies only the active-scan constraint, not unrelated failures',()=>{
 expect(scanStartError({code:'23505',message:'duplicate key value violates unique constraint "one_active_cms_scan"'})).toBe('active');
 expect(scanStartError({code:'23505',message:'duplicate key value violates unique constraint "cms_scans_pkey"'})).toBe('start');
 expect(scanStartError({code:'42501',message:'permission denied'})).toBe('start');
});
