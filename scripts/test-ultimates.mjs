import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true });

async function run() {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  
  // Inject return player state
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('samsara.tutorial.done', '1');
      localStorage.setItem('samsara.meta.v2', JSON.stringify({
        schema: 2,
        savedAt: '2026-01-01T00:00:00.000Z',
        data: { totalCycles: 7, rp: 120, character: 'tiger', language: 'ko' }
      }));
    } catch {}
  });

  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);

  // Click START
  console.log('Clicking main start button...');
  await p.locator('button:visible').filter({ hasText: /시작|PLAY/ }).first().click({ timeout: 4000 });
  await p.waitForTimeout(2000);

  console.log('Evaluating ultimate weapon test in game context...');
  const results = await p.evaluate(async () => {
    const engine = window._engine;
    const getWorld = window._getWorld;
    if (!engine || !getWorld) {
      return { error: 'Engine or World accessor not found on window object.' };
    }

    const pool = engine.drawCardChoices(100);
    const tags = ['fire', 'ice', 'gold', 'time', 'chaos'];
    const logs = [];

    for (const tag of tags) {
      const card = pool.find(c => c.tags && c.tags.includes(tag));
      if (!card) {
        logs.push(`No card found for tag ${tag}`);
        continue;
      }
      
      // Dispatch 7 times to get level 7 synergy
      for (let i = 0; i < 7; i++) {
        engine.dispatch({ type: 'PICK_CARD', card });
      }
      logs.push(`Successfully added 7 cards for tag ${tag}`);
    }

    // Wait for weapons to tick/apply (at least 2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2500));

    const w = getWorld();
    return {
      logs,
      _fire7Ready: w._fire7Ready,
      _ice7Ready: w._ice7Ready,
      _gold7Ready: w._gold7Ready,
      _time7Ready: w._time7Ready,
      _chaos7Ready: w._chaos7Ready,
    };
  });

  console.log('RESULTS:', JSON.stringify(results, null, 2));
  await ctx.close();
}

try {
  await run();
} catch (e) {
  console.error(e);
} finally {
  await b.close();
}
