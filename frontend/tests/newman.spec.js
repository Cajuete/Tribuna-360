import { test } from '@playwright/test';
test('screenshot newman summary', async ({ page }) => {
  await page.goto('file:///C:/Users/hp/Desktop/sistema_deportivo/docs/newman_summary.html');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_21_newman.png', fullPage: true });
});