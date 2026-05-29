// SAMSARA · 윤회 — 게임 코어 타입 정의
// docs/16_card_pool.md 와 src/data/cards.json 의 단일 진실 공급원에 1:1 매핑.

export type CardTag = 'fire' | 'ice' | 'gold' | 'time' | 'chaos' | 'echo';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type Trigger =
  | 'onTap'
  | 'onTick'
  | 'onWaveStart'
  | 'onWaveEnd'
  | 'onCombo'
  | 'onCoinThreshold'
  | 'onTapNth'
  | 'onCardPicked'
  | 'onAnyCardPicked'
  | 'onSynergy'
  | 'onLifeLost'
  | 'onComboBreak'
  | 'onAnyTrigger'
  | 'onRevive';

/** 카드/시너지/모디파이어 효과의 데이터 형식. cards.json 의 effect 객체 그대로. */
export interface Effect {
  trigger?: Trigger;
  op: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
  mult?: number;
  minMult?: number;
  maxMult?: number;
  elseMult?: number;
  chance?: number;
  duration?: number;
  interval?: number;
  delay?: number;
  everyN?: number;
  threshold?: number;
  tag?: CardTag;
  rarity?: Rarity;
  scale?: string;
  condition?: string;
  permanent?: boolean;
  limit?: number | 'perWave';
  effect?: string; // ultimate 효과 이름 (synergy 7장 등)
  intensity?: number;
}

export interface Card {
  id: string;
  name_ko?: string;
  name_en?: string;
  tags: CardTag[];
  rarity: Rarity;
  effects: Effect[];
  unlock?: SecretUnlock;
}

export interface SecretUnlock {
  type: string;
  [key: string]: unknown;
}

export interface SynergyDef {
  tag: CardTag;
  tier: 3 | 5 | 7;
  id: string;
  name_ko: string;
  name_en: string;
  effects: Effect[];
}

export interface ModifierDef {
  id: string;
  type: 'blessing' | 'challenge' | 'secret';
  name_ko: string;
  effects: Effect[];
  unlock?: SecretUnlock;
}

export interface RunIdentityDef {
  id: string;
  match: Partial<Record<CardTag, number>>;
  name_ko: string;
  name_en: string;
  visual?: string;
  legendary?: boolean;
  bonus?: Effect[];
}

export interface CardsData {
  version: number;
  tags: CardTag[];
  rarity_distribution: Record<Rarity, number>;
  cards: Card[];
  secret_cards: Card[];
  synergies: SynergyDef[];
  modifiers: ModifierDef[];
  run_identities: RunIdentityDef[];
}

// ─────────────────────────── 게임 상태 ───────────────────────────

export type Phase = 'idle' | 'playing' | 'paused' | 'cardPick' | 'ritual' | 'over' | 'transcend' | 'boss';

export interface GameState {
  phase: Phase;

  // 시간
  wave: number;
  waveTimeMax: number;
  waveTimeRemaining: number;
  elapsed: number; // 본 웨이브 시작부터 초
  timeScale: number; // 1.0 기본 (모디/카드로 변경)

  // 점수/콤보
  coins: number;          // 이번 웨이브 코인 (점수)
  totalScore: number;     // 누적 점수
  combo: number;
  comboMaxThisWave: number;
  comboMaxRun: number;
  comboWindow: number;    // 0.3 기본
  lastTapTime: number;    // performance.now() 형식
  tapCount: number;       // 본 웨이브 누적 탭 수

  // 라이프
  life: number;
  lifeMax: number;
  reviveAvailable: number;

  // 카드 / 모디파이어
  cards: Card[];
  modifierThisWave: ModifierDef | null;

  // 활성 시너지 + Run Identity
  activeSynergies: string[];
  runIdentity: string | null;

  // 보스 (보스 웨이브일 때만 set)
  bossActive: boolean;
  bossTargetScore: number;
  bossKind: 'normal' | 'mega' | 'divine' | null;

  // 멀티플라이어
  globalScoreMult: number;
  tapMult: number;
  coinGainMult: number;

  // 플래그/카운터
  preserveComboCount: number;
  negateFirstLifeLoss: boolean;
  autoTriggerExtra: number; // extraTriggerCount 누적

  // 모디파이어/카드로 켜지는 일시 플래그 (웨이브 단위)
  darkMode: boolean;
  hideScore: boolean;
  muteSfx: boolean;
  flipScreenH: boolean;
  comboInverse: boolean;
  disableCardEffects: boolean;
  buffComboBonusMult: number;
  buffAutoEffectsMult: number;
  scoreMultOnComboBreak: number;
  hotspotMult: number;
  extraCardChoiceCount: number;
  extraModifierCount: number;
  doubleNextRandomEffect: boolean;
  carriedCoinsNextWave: number;
  invertChance: number; // 효과의 chance 반전 확률
  rewindsAvailable: number;
  forceNextCardRarity: Rarity | null;
  rerollsRemaining: number;
  buffOneCardEffectMult: number; // 다음 카드 1장 효과 ×
  cardBuffStacks: number; // 시너지/카드로 모든 카드 효과에 곱 (런 전체)

  // 메타 (런 시작 시 주입, 런 중에는 변경 X)
  meta: MetaState;

  // 누적 통계
  stats: RunStats;
}

export interface MetaState {
  rp: number;                 // 환생 포인트
  totalCycles: number;        // 누적 사이클
  totalCoins: number;         // 누적 코인
  unlockedCardIds: string[];
  unlockedModifierIds: string[];
  unlockedSkinIds: string[];
  unlockedBgmIds: string[];
  startingLifeBonus: number;
  startingCardSlotBonus: number;
  startingCoinsBonus: number;
  rpRateBonus: number;
  achievements: string[];
  bestScore: number;
  yesterdayScore: number;
  language: 'ko' | 'en';
  bgmVol: number;
  sfxVol: number;
  shakeEnabled: boolean;
  flashEnabled: boolean;
  reducedMotion: boolean;
  // ⭐ 접근성 — 색약 모드 (research P0): 색만으로 정보를 전달하지 않음.
  // 빨강/시안 → 주황/노랑 팔레트 + 데미지 숫자에 shape suffix(●○◆◇★) 추가.
  colorblindMode?: boolean;
  // ⭐ FPS 표시 — 기본 OFF (일반 사용자에겐 디버그 UI). 옵션에서 ON 가능.
  // 1차 60% 동료 개발자가 *신뢰 시그널* 로 켜 볼 수 있게.
  showFps?: boolean;
  // ⭐ 윤회 계승 — 직전 런에서 가장 많이 픽한 태그의 마지막 카드 1장이 다음 런에 자동 부여.
  // SAMSARA 정체성을 메커니즘으로 표현 ("죽음은 끝이 아니라 다시 태어나는 문").
  legacyCardId?: string;
  // ⭐ 메타 50단계 미세 강화 (VS 패턴 — 각 단계 +5%, 최대 50단계).
  // 매 단계는 미미하지만 누적은 강력. 매 RP 5 비용.
  metaHpStacks?: number;        // +5% HP per stack (cap 50 → +250%)
  metaDmgStacks?: number;       // +5% damage per stack
  metaSpeedStacks?: number;     // +5% move speed per stack (cap 30%로 제한 — 가독성)
  metaMagnetStacks?: number;    // +5% pickup magnet radius per stack
  // ⭐ 깊이 가시화 — 평생 누적 발견 집합. 10분 플레이로 안 보이는 시스템 폭을
  // 게임오버 화면에 "N / 28 정체성 발견" 식으로 노출 (동료 개발자 표 60% 직격).
  // reducer(handleGameOver)만 갱신, UI 는 read-only.
  seenIdentityIds?: string[];   // 평생 발현한 Run Identity id 집합 (총 28종)
  seenSynergyIds?: string[];    // 평생 경험한 시너지 id 집합 (총 18종)
  seenModifierIds?: string[];   // 평생 경험한 웨이브 모디파이어 id 집합 (총 30종)
  seenBiomeIds?: string[];      // 평생 밟아본 생태계(biome) 집합 (총 4종)
}

export interface RunStats {
  startedAt: number;
  tapsTotal: number;
  cardsPicked: number;
  bossesDefeated: number;
  synergyTriggers: Record<string, number>;
  highlightEvents: HighlightEvent[];
  // ⭐ 사망 원인 (death recap)
  lastHitCause?: string;       // 마지막 피격 적/원인 ("dokkaebi" / "blackhole" 등)
  lastHitDmg?: number;
  lastHitWave?: number;
  lastHitTime?: number;        // 사이클 시작 후 초
  // ⭐ 이번 런에서 처음 발견한 것 (게임오버 "NEW" 배지용). handleGameOver 가 set.
  newIdentityThisRun?: boolean; // 이번 런 Run Identity 가 평생 최초 발현
  newSynergyThisRun?: number;   // 이번 런 최초 경험한 시너지 개수
  newModifierThisRun?: number;  // 이번 런 최초 경험한 모디파이어 개수
  newBiomeThisRun?: number;     // 이번 런 최초 밟은 biome 개수
  // ⭐ 이번 런 실제 획득 RP (점수 환산 + 첫 5런 보장 보너스 포함). 게임오버 화면이
  //   이 값을 그대로 표시 — 표시 숫자와 메타 실제 누적이 어긋나지 않게 단일 진실원.
  rpEarnedThisRun?: number;
  // ⭐ 이번 런에서 경험한 모디파이어/biome id (run-scoped 누적). handleGameOver 가
  //   meta.seenModifierIds / seenBiomeIds 로 머지. 시뮬→reducer 는 Action 경유(불변식 유지).
  modifierIds?: string[];       // 이번 런에서 발동된 모디파이어 id (중복 제거)
  biomeIds?: string[];          // 이번 런에서 진입한 biome (중복 제거)
}

export interface HighlightEvent {
  t: number;       // 사이클 시작 후 초
  type: 'maxCombo' | 'synergy' | 'bossDefeat' | 'legendary' | 'bigPayout';
  payload: Record<string, unknown>;
}

// ─────────────────────────── 사이드 이펙트(이벤트) ───────────────────────────
// reducer 는 순수. 사이드 이펙트는 이벤트로 발행 → 렌더/오디오/UI 가 구독.

export type EngineEvent =
  | { type: 'COIN_GAIN'; value: number; x?: number; y?: number; reason?: string }
  | { type: 'COMBO_CHANGE'; from: number; to: number; reason?: string }
  | { type: 'COMBO_THRESHOLD'; level: 3 | 5 | 10 | 25 | 50 | 100 | 200 | 500 }
  | { type: 'TIME_FREEZE'; duration: number }
  | { type: 'SCREEN_SHAKE'; intensity: number; duration: number }
  | { type: 'PARTICLE'; kind: string; x: number; y: number; count?: number }
  | { type: 'NUMBER_POPUP'; text: string; x: number; y: number; color?: string; size?: number }
  | { type: 'SFX'; id: string; volume?: number }
  | { type: 'BGM_LAYER'; layer: 0 | 1 | 2 | 3; target: number; ramp?: number }
  | { type: 'SYNERGY_FIRED'; id: string; tier: 3 | 5 | 7 }
  | { type: 'IDENTITY_FIRED'; id: string }
  | { type: 'TEXT_BANNER'; text: string; durationMs: number }
  | { type: 'WAVE_START'; wave: number }
  | { type: 'WAVE_END'; wave: number; coins: number }
  | { type: 'LIFE_LOST'; remaining: number }
  | { type: 'GAME_OVER' }
  | { type: 'TRANSCEND' };

// ─────────────────────────── Action(reducer 입력) ───────────────────────────

export type Action =
  | { type: 'TAP'; x?: number; y?: number; t: number }
  | { type: 'TICK'; dt: number; t: number }
  | { type: 'START_WAVE'; wave: number }
  | { type: 'END_WAVE' }
  | { type: 'PICK_CARD'; card: Card }
  | { type: 'SKIP_CARD' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'BOSS_DEFEATED'; timeUsed: number }
  | { type: 'BOSS_FAILED' }
  | { type: 'GAME_OVER' }
  | { type: 'ENEMY_KILLED'; coins: number; streak: number; x?: number; y?: number; kind?: string }
  | { type: 'PICKUP'; coins?: number; xp?: number; x?: number; y?: number; kind?: string }
  | { type: 'PLAYER_HIT'; dmg: number; cause?: string }
  // ⭐ 시뮬(world)이 플레이어의 현재 biome 변화를 reducer 에 통지 (PLAYER_HIT 패턴 동일).
  //   reducer 가 state.stats.biomeIds 에 dedupe 누적 → handleGameOver 가 meta 머지.
  | { type: 'BIOME_SEEN'; biome: string }
  // ⭐ 신규 — prop 이 부여하는 영구/일시 버프 (shrine pray 영구 maxHP +1 등).
  // kind 종류:
  //   'maxHpPermanent' — lifeMax += amount, life 도 같이 증가. duration 무시.
  | { type: 'BUFF_GAIN'; kind: 'maxHpPermanent'; amount: number };

// ─────────────────────────── 트리거 컨텍스트 ───────────────────────────

export interface TriggerContext {
  trigger: Trigger;
  state: GameState;
  /** 이벤트 큐에 푸시 — 효과가 사이드 이펙트(파티클/사운드 등) 발행 시 사용 */
  emit: (event: EngineEvent) => void;
  /** 새로운 효과를 본 트리거에서 다시 디스패치 (echo 패턴) */
  dispatch: (effects: Effect[], context?: Partial<TriggerContext>) => void;
  /** 트리거 발생 좌표 (탭 등) */
  x?: number;
  y?: number;
  /** 그 외 페이로드 (예: 콤보 임계 레벨) */
  data?: Record<string, unknown>;
}

/** 단일 op 핸들러 — state 를 변형하고 이벤트 발행 */
export type OpHandler = (effect: Effect, ctx: TriggerContext) => void;
