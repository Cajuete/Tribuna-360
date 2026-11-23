import { test } from '@playwright/test';
test('screenshot playwright report', async ({ page }) => {
  await page.goto('file:///C:/Users/hp/Desktop/sistema_deportivo/frontend/playwright-report/index.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_08_playwright_report.png', fullPage: true });
});