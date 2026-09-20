import { expect,it } from 'vitest';
import { successfulReviewSource } from './successful-review';
import type { FieldChange } from './change-plan';
const field=(type:string,after:unknown)=>({occurrence:{field_type:type},after}) as FieldChange;
it('keeps the exact strings and JSON representation used by scan detection',()=>{
  expect(successfulReviewSource(field('PlainText','Novo valor'),'Novo valor')).toBe('Novo valor');
  expect(successfulReviewSource(field('Number',42),42)).toBe('42');
  const image={url:'https://cdn.test/image.jpg',alt:'My image'};
  expect(successfulReviewSource(field('Image',image),image)).toBe(JSON.stringify(image));
});
it('does not pre-review transformed images or mismatched content',()=>{
  expect(successfulReviewSource(field('Image',{url:'https://input.test/a.jpg'}),{url:'https://cdn.test/b.jpg'})).toBeUndefined();
  expect(successfulReviewSource(field('PlainText','new'),'external')).toBeUndefined();
});
