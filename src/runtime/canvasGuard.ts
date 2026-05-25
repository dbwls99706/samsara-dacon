// SAMSARA · 윤회 — Canvas API 안전 래퍼
//
// 음수 반지름 / NaN / Infinity 같은 잘못된 인자가 ctx.arc / createRadialGradient 에
// 들어가서 캔버스 메서드가 throw 하는 경우를 막는다 (프로덕션 안정성).
//
// 부동소수점 드리프트 (예: 1 - age/duration 이 -0.0001 이 되는 경우) 가 흔한 원인.

let installed = false;

export function installCanvasGuards(): void {
  if (installed) return;
  installed = true;
  if (typeof CanvasRenderingContext2D === 'undefined') return;

  const proto = CanvasRenderingContext2D.prototype;

  const origArc = proto.arc;
  proto.arc = function (this: CanvasRenderingContext2D, x: number, y: number, r: number, sa: number, ea: number, ccw?: boolean) {
    if (!Number.isFinite(r) || r < 0) r = 0;
    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;
    if (!Number.isFinite(sa)) sa = 0;
    if (!Number.isFinite(ea)) ea = 0;
    return origArc.call(this, x, y, r, sa, ea, ccw);
  } as typeof proto.arc;

  const origEllipse = proto.ellipse;
  if (origEllipse) {
    proto.ellipse = function (this: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, sa: number, ea: number, ccw?: boolean) {
      if (!Number.isFinite(rx) || rx < 0) rx = 0;
      if (!Number.isFinite(ry) || ry < 0) ry = 0;
      if (!Number.isFinite(rot)) rot = 0;
      if (!Number.isFinite(sa)) sa = 0;
      if (!Number.isFinite(ea)) ea = 0;
      return origEllipse.call(this, x, y, rx, ry, rot, sa, ea, ccw);
    } as typeof proto.ellipse;
  }

  const origRG = proto.createRadialGradient;
  proto.createRadialGradient = function (this: CanvasRenderingContext2D, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    if (!Number.isFinite(r0) || r0 < 0) r0 = 0;
    if (!Number.isFinite(r1) || r1 < 0) r1 = 0;
    return origRG.call(this, x0, y0, r0, x1, y1, r1);
  } as typeof proto.createRadialGradient;

  // 음수 lineWidth 도 silently 클램프 (스펙상 무시되지만 디버그 깨끗함)
  const desc = Object.getOwnPropertyDescriptor(proto, 'lineWidth');
  if (desc && desc.set) {
    Object.defineProperty(proto, 'lineWidth', {
      configurable: true,
      get: desc.get,
      set: function (v: number) {
        if (!Number.isFinite(v) || v < 0) v = 0;
        desc.set!.call(this, v);
      },
    });
  }

  // globalAlpha 도 0~1 범위 보호
  const aDesc = Object.getOwnPropertyDescriptor(proto, 'globalAlpha');
  if (aDesc && aDesc.set) {
    Object.defineProperty(proto, 'globalAlpha', {
      configurable: true,
      get: aDesc.get,
      set: function (v: number) {
        if (!Number.isFinite(v)) v = 1;
        if (v < 0) v = 0;
        if (v > 1) v = 1;
        aDesc.set!.call(this, v);
      },
    });
  }
}
