import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('Email').fill('admin.demo@example.com');
  await page.getByPlaceholder('Contrase\u00f1a').fill('TestStock123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

test('Login exitoso redirige al panel', async ({ page }) => {
  await login(page);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_10_login_ok.png', fullPage: true });
});

test('Panel admin despues de login', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_11_admin.png', fullPage: true });
});

test('Tienda despues de login', async ({ page }) => {
  await login(page);
  await page.goto('/tienda');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_12_tienda_auth.png', fullPage: true });
});

test('Socios despues de login', async ({ page }) => {
  await login(page);
  await page.goto('/socios');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_13_socios.png', fullPage: true });
});

test('Mis entradas despues de login', async ({ page }) => {
  await login(page);
  await page.goto('/mis-entradas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_14_misentradas.png', fullPage: true });
});

test('Mis pedidos despues de login', async ({ page }) => {
  await login(page);
  await page.goto('/mis-pedidos');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_15_mispedidos.png', fullPage: true });
});

test('Mi perfil despues de login', async ({ page }) => {
  await login(page);
  await page.goto('/mi-perfil');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_16_miperfil.png', fullPage: true });
});

test('Club Bolivar despues de login', async ({ page }) => {
  await login(page);
  await page.goto('/club/club-bolivar');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_17_club.png', fullPage: true });
});

test('Vista movil admin', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/hp/Desktop/sistema_deportivo/docs/images/pw_18_admin_mobile.png', fullPage: true });
});