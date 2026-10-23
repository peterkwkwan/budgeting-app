import { View, type StyleProp, type ViewStyle } from 'react-native';

type IconProps = {
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Simple line icons — no @expo/vector-icons (Metro-safe). */

export function ListIcon({ color, size = 22, style }: IconProps) {
  const stroke = Math.max(1.5, size * 0.08);
  const gap = size * 0.22;
  const startY = size * 0.22;
  return (
    <View style={[{ width: size, height: size }, style]}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: size * 0.28,
            top: startY + i * gap,
            width: size * 0.62,
            height: stroke,
            borderRadius: stroke,
            backgroundColor: color,
          }}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <View
          key={`d-${i}`}
          style={{
            position: 'absolute',
            left: size * 0.08,
            top: startY + i * gap - stroke * 0.2,
            width: stroke * 1.4,
            height: stroke * 1.4,
            borderRadius: stroke,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

export function BarsIcon({ color, size = 22, style }: IconProps) {
  const w = size * 0.16;
  const gap = size * 0.14;
  const left = (size - (3 * w + 2 * gap)) / 2;
  const heights = [0.45, 0.72, 0.55];
  return (
    <View style={[{ width: size, height: size }, style]}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: left + i * (w + gap),
            bottom: size * 0.12,
            width: w,
            height: size * h,
            borderRadius: w / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

export function UserIcon({ color, size = 22, style }: IconProps) {
  const head = size * 0.32;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.08,
          left: (size - head) / 2,
          width: head,
          height: head,
          borderRadius: head / 2,
          borderWidth: Math.max(1.5, size * 0.08),
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.06,
          left: size * 0.12,
          right: size * 0.12,
          height: size * 0.36,
          borderTopLeftRadius: size * 0.4,
          borderTopRightRadius: size * 0.4,
          borderWidth: Math.max(1.5, size * 0.08),
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}

export function PlusIcon({ color, size = 30, style }: IconProps) {
  const stroke = Math.max(2.25, size * 0.1);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: 'absolute',
          left: (size - stroke) / 2,
          top: size * 0.18,
          width: stroke,
          height: size * 0.64,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: (size - stroke) / 2,
          left: size * 0.18,
          width: size * 0.64,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function MicIcon({ color, size = 22, style }: IconProps) {
  const capsuleW = size * 0.32;
  const capsuleH = size * 0.48;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.06,
          left: (size - capsuleW) / 2,
          width: capsuleW,
          height: capsuleH,
          borderRadius: capsuleW / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.42,
          left: size * 0.18,
          right: size * 0.18,
          height: size * 0.28,
          borderWidth: Math.max(1.5, size * 0.08),
          borderTopWidth: 0,
          borderBottomLeftRadius: size * 0.28,
          borderBottomRightRadius: size * 0.28,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (size - Math.max(1.5, size * 0.08)) / 2,
          top: size * 0.7,
          width: Math.max(1.5, size * 0.08),
          height: size * 0.14,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.28,
          bottom: size * 0.06,
          width: size * 0.44,
          height: Math.max(1.5, size * 0.08),
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
