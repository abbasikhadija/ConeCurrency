import {test,expect} from '@playwright/test';

test('student joins, receives a real backend response, and cannot use admin controls',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Your display name').fill('Classmate One');
  await page.getByRole('button',{name:'Join the shop'}).click();
  await expect(page.getByRole('heading',{name:'Hello, Classmate One!'})).toBeVisible();
  await page.getByRole('button',{name:'Order one ice cream'}).click();
  await expect(page.getByRole('status')).toHaveText('Your ice cream is ready!');
  await expect(page.getByLabel('Your ice cream',{exact:true})).toBeVisible();
  expect((await page.request.post('/api/burst',{data:{count:50}})).status()).toBe(401);
});

test('admin login protects round control and logout revokes access',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Admin login'}).click();
  await page.getByLabel('Admin password').fill('classroom-test-only');
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page.getByRole('heading',{name:'Admin — start a new round'})).toBeVisible();
  await page.getByRole('button',{name:'Log out'}).click();
  await expect(page.getByRole('heading',{name:'Welcome to ConeCurrency 🍦'})).toBeVisible();
  expect((await page.request.post('/api/reset',{data:{}})).status()).toBe(401);
});
