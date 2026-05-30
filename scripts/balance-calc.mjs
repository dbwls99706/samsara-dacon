import fs from 'node:fs';

const cardsData = JSON.parse(fs.readFileSync('src/data/cards.json', 'utf8'));

console.log('=== SAMSARA CARD BALANCE ANALYSIS ===\n');

// 1. Analyze cards relative value
// Standard play stats assumptions:
// - Taps per second (TPS): 6 (active player click speed)
// - Wave length: 60s (W3+)
// - Average combo: 20
// - Combo bucket multiplier (comboBuckets5): 1 + Math.floor(20/5) = 5x
// - Chance ops: average over trials

const TPS = 6;
const WAVE_DURATION = 60;
const AVG_COMBO = 20;
const COMBO_MULT = 1 + Math.floor(AVG_COMBO / 5); // 5x

const cardValue = cardsData.cards.map(c => {
  let valPerSec = 0;
  let desc = '';
  c.effects.forEach(eff => {
    let base = 0;
    if (eff.op === 'addCoins') {
      if (eff.value !== undefined) base = eff.value;
      else if (eff.minValue !== undefined && eff.maxValue !== undefined) {
        base = (eff.minValue + eff.maxValue) / 2;
      }
      if (eff.scale === 'comboBuckets5') base *= COMBO_MULT;
    }
    
    // Trigger adjustments
    let triggersPerSec = 0;
    if (eff.trigger === 'onTap') {
      triggersPerSec = TPS;
      if (eff.chance !== undefined) triggersPerSec *= eff.chance;
    } else if (eff.trigger === 'onTapNth') {
      triggersPerSec = TPS / (eff.everyN ?? 1);
      if (eff.condition === 'comboGte:10') {
        // Assume player has combo >= 10 half the time
        triggersPerSec *= 0.5;
      }
    } else if (eff.trigger === 'onTick') {
      triggersPerSec = 1 / (eff.interval ?? 1);
    } else if (eff.trigger === 'onWaveStart') {
      triggersPerSec = 1 / WAVE_DURATION;
    } else if (eff.trigger === 'onWaveEnd') {
      triggersPerSec = 1 / WAVE_DURATION;
    }

    let contribution = base * triggersPerSec;
    
    // Other ops: estimate score equivalent
    if (eff.op === 'tapMult') {
      let multiplier = eff.mult ?? 1;
      let chance = eff.chance ?? 1;
      // tap base is 1, so tapMult adds (multiplier - 1) * tap base
      contribution = (multiplier - 1) * 1 * TPS * chance;
    } else if (eff.op === 'tapMultGamble') {
      let mult = eff.mult ?? 3;
      let chance = eff.chance ?? 0.5;
      let elseMult = eff.elseMult ?? 0;
      contribution = ((mult * chance + elseMult * (1 - chance)) - 1) * 1 * TPS;
    } else if (eff.op === 'coinGainMult') {
      // Estimate coinGainMult 1.5x on average wave coins (assume 10,000 coins / wave)
      contribution = (10000 * (eff.mult - 1)) / WAVE_DURATION;
    } else if (eff.op === 'globalScoreMult') {
      // Estimate global score multiplication on 10,000 base
      contribution = (10000 * (eff.mult - 1)) / WAVE_DURATION;
    } else if (eff.op === 'scoreMult') {
      // Estimate score multiplier on wave end
      let mult = (eff.minMult !== undefined && eff.maxMult !== undefined) 
        ? (eff.minMult + eff.maxMult) / 2 
        : (eff.value ?? 1);
      contribution = (10000 * (mult - 1)) / WAVE_DURATION;
    }

    valPerSec += contribution;
    desc += `[${eff.trigger} -> ${eff.op} (contrib: ${contribution.toFixed(1)}/s)] `;
  });

  return {
    id: c.id,
    name: c.name_ko,
    tags: c.tags,
    rarity: c.rarity,
    valPerSec,
    desc
  };
});

cardValue.sort((a, b) => b.valPerSec - a.valPerSec);

console.log('| ID | Name | Rarity | Tags | Est. Value/sec (Coins) | Breakdown |');
console.log('|---|---|---|---|---|---|');
cardValue.forEach(c => {
  console.log(`| ${c.id} | ${c.name} | ${c.rarity} | ${c.tags.join(',')} | ${c.valPerSec.toFixed(1)} | ${c.desc} |`);
});
