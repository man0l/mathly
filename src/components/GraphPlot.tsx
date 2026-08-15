import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { colors, typography } from '../theme/tokens';
import type { GraphSpec } from '../types';

/**
 * Tiny expression evaluator for plot specs returned by the API. Supports the
 * grammar the solve endpoint emits: + - * / ^, parentheses, x, sin/cos/tan/exp/
 * log/sqrt/abs, and constants pi/e. Implicit multiplication (2x, 3(x+1)) is
 * normalized to explicit form; anything still unparseable yields NaNs instead
 * of throwing.
 */
function compile(expr: string): (x: number) => number {
  const normalized = expr
    .replace(/\s+/g, '')
    .replace(/\^/g, '**')
    .replace(/\bpi\b/g, 'PI')
    .replace(/\bln\b/g, 'log')
    // digit/paren/closing-paren followed by a variable or function name → multiply
    .replace(/([\d)])x(?![a-zA-Z])/g, '$1*x')
    .replace(/([\d)])\(/g, '$1*(')
    .replace(/\)x/g, ')*x');
  let fn: (x: number) => unknown;
  try {
    fn = new Function('x', `with (Math) { return (${normalized}); }`) as (x: number) => unknown;
  } catch {
    return () => NaN;
  }
  return (x: number) => {
    try {
      const v = fn(x);
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  };
}

const W = 320;
const H = 200;
const PAD = 8;

export function GraphPlot({ spec }: { spec: GraphSpec }) {
  const { path, zeroY, zeroX } = useMemo(() => {
    const f = compile(spec.expression);
    const xs: number[] = [];
    const ys: number[] = [];
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const x = spec.xMin + ((spec.xMax - spec.xMin) * i) / N;
      const y = f(x);
      xs.push(x);
      ys.push(y);
    }
    const finite = ys.filter((y) => Number.isFinite(y));
    let lo = Math.min(...finite);
    let hi = Math.max(...finite);
    const span = hi - lo || 1;
    lo -= span * 0.12;
    hi += span * 0.12;

    const xToPx = (x: number) => PAD + ((x - spec.xMin) / (spec.xMax - spec.xMin)) * (W - 2 * PAD);
    const yToPx = (y: number) => H - PAD - ((y - lo) / (hi - lo)) * (H - 2 * PAD);

    let d = '';
    let penDown = false;
    for (let i = 0; i < xs.length; i++) {
      const y = ys[i];
      if (!Number.isFinite(y)) {
        penDown = false;
        continue;
      }
      const px = xToPx(xs[i]).toFixed(1);
      const py = yToPx(y).toFixed(1);
      d += `${penDown ? 'L' : 'M'}${px} ${py} `;
      penDown = true;
    }

    const zeroY = lo < 0 && hi > 0 ? yToPx(0) : null;
    const zeroX = spec.xMin < 0 && spec.xMax > 0 ? xToPx(0) : null;
    return { path: d.trim(), yMin: lo, yMax: hi, xToPx, yToPx, zeroY, zeroX };
  }, [spec]);

  return (
    <View>
      <Svg width={W} height={H} style={styles.svg}>
        {/* grid */}
        {[0.25, 0.5, 0.75].map((t) => (
          <Line
            key={`h${t}`}
            x1={PAD}
            x2={W - PAD}
            y1={PAD + t * (H - 2 * PAD)}
            y2={PAD + t * (H - 2 * PAD)}
            stroke="rgba(148,163,204,0.08)"
            strokeWidth="1"
          />
        ))}
        {[0.25, 0.5, 0.75].map((t) => (
          <Line
            key={`v${t}`}
            y1={PAD}
            y2={H - PAD}
            x1={PAD + t * (W - 2 * PAD)}
            x2={PAD + t * (W - 2 * PAD)}
            stroke="rgba(148,163,204,0.08)"
            strokeWidth="1"
          />
        ))}
        {/* axes */}
        {zeroY !== null ? (
          <Line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} stroke="rgba(148,163,204,0.3)" strokeWidth="1" />
        ) : null}
        {zeroX !== null ? (
          <Line x1={zeroX} x2={zeroX} y1={PAD} y2={H - PAD} stroke="rgba(148,163,204,0.3)" strokeWidth="1" />
        ) : null}
        <Path d={path} stroke="#7C5CFC" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={styles.legendRow}>
        <Text style={styles.legend}>y = {spec.expression}</Text>
        <Text style={styles.legend}>
          x ∈ [{spec.xMin}, {spec.xMax}]
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { alignSelf: 'center' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  legend: { ...typography.small, color: colors.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' },
});
