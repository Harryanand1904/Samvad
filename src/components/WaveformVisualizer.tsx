import React, { useRef, useEffect } from 'react';
import { View, Animated } from 'react-native';
import { colors } from '../theme';

interface WaveformVisualizerProps {
  isActive: boolean;
  barCount?: number;
  color?: string;
  height?: number;
}

export function WaveformVisualizer({ isActive, barCount = 6, color = colors.accent, height = 36 }: WaveformVisualizerProps) {
  const bars = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.15))
  ).current;
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (isActive) {
      animationsRef.current = bars.map((bar, i) => {
        const duration = 350 + i * 80;
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(bar, { toValue: 0.3 + (i % 3) * 0.25, duration, useNativeDriver: false }),
            Animated.timing(bar, { toValue: 0.1 + (i % 2) * 0.15, duration: duration * 0.7, useNativeDriver: false }),
          ])
        );
        loop.start();
        return loop;
      });
    } else {
      animationsRef.current.forEach(a => a.stop());
      animationsRef.current = bars.map(bar => {
        const anim = Animated.timing(bar, { toValue: 0.15, duration: 200, useNativeDriver: false });
        anim.start();
        return anim;
      });
    }
    return () => animationsRef.current.forEach(a => a.stop());
  }, [isActive, bars]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height }}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: 4,
            height: bar.interpolate({ inputRange: [0, 1], outputRange: [4, height] }),
            borderRadius: 2,
            backgroundColor: color,
            marginHorizontal: 2,
            opacity: isActive ? 1 : 0.3,
          }}
        />
      ))}
    </View>
  );
}
