import React, { useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Circle, Path, Stop, Text as SvgText } from "react-native-svg";
import { computeDayTicks, computeYAxis } from "../domain/chartScale";
import { indexFromX, toneOf, type Tone } from "../domain/chartModel";
import type { GraphPoint } from "../domain/types";
import { shortDate } from "../format";
import { colors } from "../theme";

const MARGIN = { top: 18, right: 16, bottom: 30, left: 40 };
const TONE_COLOR: Record<Tone, string> = { up: colors.chartLine, down: colors.chartSlip, flat: colors.chartFlat };

interface Props {
  /** Chronological scored points (habit or combined). The chart never recomputes ratings. */
  points: readonly GraphPoint[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  accessibilitySummary: string;
  height?: number;
}

/**
 * Running-rating chart: day on X, cumulative rating on Y. Each segment is coloured by the transition
 * it represents (up / down / level). Touch or drag anywhere on the plot to pick the nearest day.
 * All geometry derives from `points` and the measured width; nothing is hard-coded.
 */
export function RatingChart({ points, selectedIndex, onSelect, accessibilitySummary, height = 250 }: Props) {
  const [width, setWidth] = useState(0);
  const boxRef = useRef<React.ComponentRef<typeof View>>(null);
  const originX = useRef(0);
  const count = points.length;

  const plotW = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;

  // Latest values for the (stable) gesture handlers.
  const live = useRef({ plotW, count, onSelect });
  live.current = { plotW, count, onSelect };

  const responder = useMemo(() => {
    const pick = (pageX: number) => {
      const { plotW: w, count: n, onSelect: cb } = live.current;
      const i = indexFromX(pageX - originX.current, MARGIN.left, w, n);
      if (i !== null) cb(i);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Horizontal drags scrub; vertical drags are released so the page can still scroll.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => pick(e.nativeEvent.pageX),
      onPanResponderMove: (e) => pick(e.nativeEvent.pageX),
      onPanResponderTerminationRequest: () => true,
    });
  }, []);

  const yAxis = useMemo(() => computeYAxis(points.flatMap((p) => [p.rating, p.previousRating])), [points]);
  const dayTicks = useMemo(() => computeDayTicks(count, plotW, 56), [count, plotW]);

  const x = (day: number) => MARGIN.left + (day / Math.max(1, count)) * plotW;
  const y = (rating: number) => MARGIN.top + (1 - (rating - yAxis.min) / (yAxis.max - yAxis.min)) * plotH;
  const bandW = plotW / Math.max(1, count);
  const markerR = bandW < 8 ? 2.5 : bandW < 16 ? 3.5 : 4.5;

  const area = useMemo(() => {
    if (!count || width === 0) return "";
    const first = points[0]!;
    const pts = [`${x(0)},${y(first.previousRating)}`, ...points.map((p, i) => `${x(i + 1)},${y(p.rating)}`)];
    const floor = y(yAxis.min);
    return `M${pts.join(" L")} L${x(count)},${floor} L${x(0)},${floor} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, width, yAxis, height]);

  return (
    <View
      ref={boxRef}
      style={{ height }}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
        boxRef.current?.measureInWindow((wx) => {
          originX.current = wx;
        });
      }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilitySummary}
      {...responder.panHandlers}
    >
      {width > 0 && count > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.chartLine} stopOpacity={0.24} />
              <Stop offset="1" stopColor={colors.chartLine} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {yAxis.ticks.map((t) => (
            <React.Fragment key={`y${t}`}>
              <Line
                x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y(t)} y2={y(t)}
                stroke={t === 0 ? colors.chartAxis : colors.chartGrid} strokeWidth={t === 0 ? 1.2 : 1}
                strokeDasharray={t === 0 ? undefined : "3,4"}
              />
              <SvgText x={MARGIN.left - 8} y={y(t) + 4} fill={colors.chartAxis} fontSize={11} textAnchor="end">
                {t < 0 ? `−${-t}` : String(t)}
              </SvgText>
            </React.Fragment>
          ))}
          {dayTicks.map((d) => (
            <React.Fragment key={`x${d}`}>
              <Line x1={x(d)} x2={x(d)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke={colors.chartGrid} strokeWidth={1} />
              <SvgText x={x(d)} y={MARGIN.top + plotH + 17} fill={colors.chartAxis} fontSize={11} textAnchor="middle">
                {shortDate(points[d - 1]!.date)}
              </SvgText>
            </React.Fragment>
          ))}
          <SvgText x={MARGIN.left} y={10} fill={colors.chartAxis} fontSize={10.5} letterSpacing={1}>RATING</SvgText>

          <Path d={area} fill="url(#area)" />

          {selectedIndex !== null && selectedIndex < count ? (
            <Line
              x1={x(selectedIndex + 1)} x2={x(selectedIndex + 1)} y1={MARGIN.top} y2={MARGIN.top + plotH}
              stroke={colors.focus} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="2,3"
            />
          ) : null}

          {points.map((p, i) => (
            <Line
              key={`s${p.date}`}
              x1={x(i)} y1={y(p.previousRating)} x2={x(i + 1)} y2={y(p.rating)}
              stroke={TONE_COLOR[toneOf(p.delta)]} strokeWidth={2.4} strokeLinecap="round"
            />
          ))}

          {points.map((p, i) => {
            const on = selectedIndex === i;
            return (
              <React.Fragment key={`d${p.date}`}>
                {on ? <Circle cx={x(i + 1)} cy={y(p.rating)} r={markerR + 5} fill={TONE_COLOR[toneOf(p.delta)]} fillOpacity={0.22} /> : null}
                <Circle
                  cx={x(i + 1)} cy={y(p.rating)} r={on ? markerR + 1.5 : markerR}
                  fill={TONE_COLOR[toneOf(p.delta)]} stroke={colors.chartBg} strokeWidth={1.5}
                />
              </React.Fragment>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
