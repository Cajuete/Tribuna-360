import { test } from '@playwright/test';
test('screenshot api results', async ({ page }) => {
  await page.goto('file:///C:/Users/hp/Desktop/sistema_deportivo/docs/api_results.html');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_09_api_results.png', fullPage: true });
});