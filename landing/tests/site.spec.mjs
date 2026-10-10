import { expect, test } from '@playwright/test';

const SCREENS = ['Main', 'SignIn', 'SignUp', 'Onboarding', 'Record', 'Workspace', 'Feedback', 'Mentor'];
const PAGES = ['index.html', ...SCREENS.flatMap((s) => [`${s}.dc.html`, `${s}Light.dc.html`])];

/** Collects console errors, page errors and failed requests for one page. */
function watchProblems(page) {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`); });
  // Everything (fonts included) is self-hosted: the site must work offline.
  page.on('request', (r) => {
    const { protocol, hostname } = new URL(r.url());
    if (protocol.startsWith('http') && hostname !== '127.0.0.1') problems.push(`external request: ${r.url()}`);
  });
  return problems;
}

test.describe('každá stránka', () => {
  for (const name of PAGES) {
    test(`${name} sa vykreslí bez chýb`, async ({ page }) => {
      const problems = watchProblems(page);
      await page.goto(name, { waitUntil: 'networkidle' });
      await expect(page.locator('[data-dc-root] > *').first()).toBeVisible();

      expect(await page.locator('body').innerText()).not.toMatch(/\{\{|\}\}/);
      // Images are inserted by the client-side render, so let them finish before judging them.
      await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15_000 });
      const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => i.naturalWidth === 0).map((i) => i.src));
      expect(broken, 'rozbité obrázky').toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'horizontálne pretečenie').toBeLessThanOrEqual(0);
      const fonts = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
      });
      expect(new Set(fonts), 'načítané fonty').toEqual(new Set(['Bricolage Grotesque', 'DM Sans', 'Outfit']));
      expect(problems).toEqual([]);
    });
  }
});

test('všetky odkazy vedú na existujúcu stránku alebo kotvu', async ({ page, request }) => {
  test.setTimeout(90_000); // walks all 17 pages
  const checked = new Set();
  for (const name of PAGES) {
    await page.goto(name);
    await expect(page.locator('[data-dc-root] > *').first()).toBeVisible();
    const links = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
    for (const href of links) {
      if (href === '#' || href.startsWith('http')) continue;
      if (href.startsWith('#')) {
        await expect(page.locator(href), `${name} → ${href}`).toHaveCount(1);
        continue;
      }
      if (checked.has(href)) continue;
      checked.add(href);
      expect((await request.get(href)).status(), `${name} → ${href}`).toBe(200);
    }
  }
  expect(checked.size).toBeGreaterThan(5);
});

test.describe('interakcie', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'tok stačí overiť raz'));

  test('landing: CTA a navigácia vedú na správne obrazovky', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Ako to funguje' }).first().click();
    await expect(page).toHaveURL(/#ako$/);
    await expect(page.locator('#ako')).toBeInViewport();

    await page.getByRole('link', { name: 'Začať trénovať →' }).click();
    await expect(page).toHaveURL(/Onboarding\.dc\.html$/);
    await page.goBack();
    await page.getByRole('link', { name: 'Prihlásiť sa' }).click();
    await expect(page).toHaveURL(/SignIn\.dc\.html$/);
    await page.getByRole('link', { name: 'Vytvoriť účet' }).click();
    await expect(page).toHaveURL(/SignUp\.dc\.html$/);
    await page.getByRole('link', { name: 'PitchIt domov' }).click();
    await expect(page).toHaveURL(/Main\.dc\.html$/);
    await page.getByRole('link', { name: 'Otvoriť ukážku dashboardu' }).click();
    await expect(page.getByRole('heading', { name: 'Prehľad tímov' })).toBeVisible();
  });

  test('registrácia: prepínač typu účtu', async ({ page }) => {
    await page.goto('SignUp.dc.html');
    const participant = page.getByRole('button', { name: 'Účastník' });
    const organizer = page.getByRole('button', { name: 'Organizátor' });
    await expect(participant).toHaveAttribute('aria-pressed', 'true');
    await organizer.click();
    await expect(organizer).toHaveAttribute('aria-pressed', 'true');
    await expect(participant).toHaveAttribute('aria-pressed', 'false');
  });

  test('onboarding: kvíz → plán → poznámky sa prenesú do pracovného priestoru', async ({ page }) => {
    await page.goto('Onboarding.dc.html');
    const next = page.getByRole('button', { name: 'Pokračovať' });
    await expect(next).toBeDisabled();
    await page.getByRole('button', { name: /Investorovi/ }).click();
    await next.click();
    await expect(page.getByText('Otázka 2 zo 3')).toBeVisible();
    await page.getByRole('button', { name: /60 sekúnd/ }).click();
    await next.click();
    await page.getByRole('button', { name: /Obsah a štruktúra/ }).click();
    await page.getByRole('button', { name: 'Potvrdiť' }).click();

    const plan = page.getByRole('dialog', { name: 'Nastavíme to na mieru.' });
    await expect(plan).toContainText('Investorovi');
    await expect(plan).toContainText('60 sekúnd');
    await expect(plan).toContainText('Obsah');
    await plan.getByRole('button', { name: 'Pokračovať' }).click();

    await page.getByLabel('Tvoje poznámky').fill('Problém: pomalý koučing');
    await page.getByRole('link', { name: 'Začať nahrávať s kamerou' }).click();
    await expect(page).toHaveURL(/Workspace\.dc\.html$/);
    await expect(page.getByLabel('Moje poznámky')).toHaveValue('Problém: pomalý koučing');
    await expect(page.getByText('Prevzaté z onboardingu')).toBeVisible();
  });

  test('pracovný priestor: pridanie bodu a nahrávanie', async ({ page }) => {
    await page.goto('Workspace.dc.html');
    await expect(page.getByText('pokrytých 2 z 6')).toBeVisible();
    const input = page.getByLabel('Pridaj bod a stlač Enter');
    await input.fill('Tím a prečo my');
    await input.press('Enter');
    await expect(page.getByText('pokrytých 2 z 7')).toBeVisible();
    await expect(input).toHaveValue('');
    await page.getByRole('button', { name: 'Pokračovať' }).click();
    await expect(page.getByRole('button', { name: 'Pozastaviť' })).toBeVisible();
    await expect(page.getByText(/^REC /)).toBeVisible();
  });

  test('nahrávanie: súhlas → odpočet → analýza → feedback', async ({ page }) => {
    await page.clock.install();
    await page.goto('Record.dc.html');
    await page.getByRole('button', { name: 'Spustiť nahrávanie' }).click();
    await expect(page.getByText('Pred nahrávaním prosím potvrď súhlas.')).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Spustiť nahrávanie' }).click();
    await expect(page.getByText('Nahrávanie sa spustí o')).toBeVisible();
    await page.clock.runFor(3500);
    await expect(page.getByText('Nahrávam', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Skončiť pitch' }).click();
    await expect(page.getByRole('heading', { name: 'Analyzujem tvoj pitch.' })).toBeVisible();
    await page.clock.runFor(4500);
    await page.getByRole('link', { name: 'Zobraziť feedback' }).click();
    await expect(page.getByRole('heading', { name: 'Tvoj feedback je hotový.' })).toBeVisible();
  });

  test('feedback: animované hodnoty a zdieľanie s mentorom', async ({ page }) => {
    await page.goto('Feedback.dc.html');
    await expect(page.getByText('4,6', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Pošli mentorovi' }).click();
    await page.getByRole('button', { name: 'Uložiť a zdieľať s mentorom' }).click();
    await expect(page.getByText('Hotovo.')).toBeVisible();
  });

  test('mentor: filter podľa najslabšej kategórie', async ({ page }) => {
    await page.goto('Mentor.dc.html');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(9);
    await page.getByRole('button', { name: 'Trh', exact: true }).click();
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Tím Alfa');
    await page.getByRole('button', { name: 'Všetko' }).click();
    await expect(rows).toHaveCount(9);
  });
});
