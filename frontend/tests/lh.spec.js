import { test } from '@playwright/test';
test('screenshot lighthouse report', async ({ page }) => {
  await page.goto('file:///C:/Users/hp/Desktop/sistema_deportivo/docs/lighthouse_preview.html');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_07_lighthouse.png', fullPage: true });
});