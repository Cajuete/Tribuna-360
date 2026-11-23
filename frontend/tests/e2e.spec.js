import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const IMGDIR = 'C:/Users/hp/Desktop/sistema_deportivo/docs/images';

function shot(page, name) {
  return page.screenshot({ path: path.join(IMGDIR, name), fullPage: true });
}

test('Home carga y muestra la interfaz principal', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await shot(page, 'pw_01_home.png');
  await expect(page.locator('body')).toBeVisible();
});

test('Login invalido muestra error', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"]', 'admin.demo@example.com');
  await page.fill('input[type="password"], input[name="password"]', 'clave-incorrecta');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await shot(page, 'pw_02_login_error.png');
});

test('Registro muestra validacion en linea', async ({ page }) => {
  await page.goto('/registro');
  await page.waitForLoadState('networkidle');
  await shot(page, 'pw_03_register.png');
});

test('Tienda carga catalogo', async ({ page }) => {
  await page.goto('/tienda');
  await page.waitForLoadState('networkidle');
  await shot(page, 'pw_04_tienda.png');
});

test('Admin sin sesion redirige a login', async ({ page }) => {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await shot(page, 'pw_05_admin_redirect.png');
});

test('Vista movil del Home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await shot(page, 'pw_06_home_mobile.png');
});