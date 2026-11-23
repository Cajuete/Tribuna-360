import { test } from '@playwright/test';
test('screenshot lighthouse tienda', async ({ page }) => {
  await page.goto('file:///C:/Users/hp/Desktop/sistema_deportivo/docs/lighthouse_tienda.html');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_19_lighthouse_tienda.png', fullPage: true });
});
test('screenshot lighthouse login', async ({ page }) => {
  await page.goto('file:///C:/Users/hp/Desktop/sistema_deportivo/docs/lighthouse_login.html');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_20_lighthouse_login.png', fullPage: true });
});