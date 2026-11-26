import { test, expect } from '@playwright/test';

test.describe('Tribuna 360 - pruebas reales del frontend', () => {
  test('la página pública carga correctamente', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Tribuna|360|Sistema/i);
    await page.screenshot({
      path: testInfo.outputPath('01-home.png'),
      fullPage: true,
    });
  });

  test('el menú de partidos abre una página independiente', async ({ page }) => {
    await page.goto('/partidos');
    await expect(page.getByRole('heading', { name: 'Todos los partidos' })).toBeVisible();
  });

  test('la validación rechaza nombres con números en el registro', async ({ page }, testInfo) => {
    await page.goto('/registro');
    await page.getByLabel('Nombre(s)').fill('Juan123');
    await page.getByLabel('Apellido paterno').fill('Perez');
    await page.getByLabel('Apellido materno').fill('Gomez');
    await page.getByLabel('Email').fill('prueba@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('Prueba123');
    await page.getByLabel('Confirmar contraseña').fill('Prueba123');
    await page.getByLabel('Teléfono').fill('+59171234567');
    await page.getByLabel('Edad').fill('25');
    await page.getByLabel('Carnet (C.I.)').fill('12345678');
    await page.getByLabel('Extensión').selectOption('CB');
    await page.getByRole('button', { name: 'Registrarme' }).click();
    await expect(page.getByText(/solo puede incluir letras/i)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('02-validacion-numeros-nombre.png'),
      fullPage: true,
    });
  });

  test('login vacío muestra validaciones reales', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText(/Escribe tu email/i)).toBeVisible();
    await expect(page.getByText(/Escribe tu contraseña/i)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('03-login-validacion.png'),
      fullPage: true,
    });
  });

  test('tienda carga en vista móvil', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tienda');
    await expect(page.getByRole('heading', { name: 'Tienda del Club' })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('04-tienda-movil.png'),
      fullPage: true,
    });
  });

  test('el botón de carrito abre su apartado independiente', async ({ page }) => {
    await page.goto('/tienda');
    await page.getByRole('link', { name: 'Carrito' }).click();
    await expect(page).toHaveURL(/\/carrito$/);
    await expect(page.getByRole('heading', { name: 'Tu Carrito' })).toBeVisible();
  });
});
