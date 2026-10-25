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

/** Flag / target-style mark for Planner tab. */
export function FlagIcon({ color, size = 22, style }: IconProps) {
  const stroke = Math.max(1.5, size * 0.09);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.22,
          top: size * 0.1,
          width: stroke,
          height: size * 0.78,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.22 + stroke,
          top: size * 0.12,
          width: size * 0.48,
          height: size * 0.36,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
          backgroundColor: color,
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

/** Trash can for selection-mode bulk delete. */
export function TrashIcon({ color, size = 22, style }: IconProps) {
  const stroke = Math.max(1.5, size * 0.08);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.22,
          right: size * 0.22,
          top: size * 0.28,
          bottom: size * 0.12,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderBottomLeftRadius: size * 0.08,
          borderBottomRightRadius: size * 0.08,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.18,
          right: size * 0.18,
          top: size * 0.22,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.36,
          right: size * 0.36,
          top: size * 0.1,
          height: size * 0.12,
          borderTopLeftRadius: size * 0.06,
          borderTopRightRadius: size * 0.06,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (size - stroke) / 2,
          top: size * 0.4,
          width: stroke,
          height: size * 0.32,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Vertical ⋮ overflow for selection-mode bulk actions. */
export function MoreIcon({ color, size = 22, style }: IconProps) {
  const dot = Math.max(2.5, size * 0.14);
  const gap = size * 0.22;
  const startY = (size - (3 * dot + 2 * gap)) / 2;
  return (
    <View style={[{ width: size, height: size }, style]}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: (size - dot) / 2,
            top: startY + i * (dot + gap),
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

/** Gear / preferences mark for Account → Settings entry. */
export function SettingsIcon({ color, size = 22, style }: IconProps) {
  const stroke = Math.max(1.5, size * 0.09);
  const ring = size * 0.5;
  const toothW = size * 0.15;
  const toothH = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <View style={[{ width: size, height: size }, style]}>
      {teeth.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <View
            key={deg}
            style={{
              position: 'absolute',
              left: cx + Math.cos(rad) * r - toothW / 2,
              top: cy + Math.sin(rad) * r - toothH / 2,
              width: toothW,
              height: toothH,
              borderRadius: toothW / 2,
              backgroundColor: color,
              transform: [{ rotate: `${deg + 90}deg` }],
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: (size - ring) / 2,
          top: (size - ring) / 2,
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (size - ring * 0.32) / 2,
          top: (size - ring * 0.32) / 2,
          width: ring * 0.32,
          height: ring * 0.32,
          borderRadius: (ring * 0.32) / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Right chevron for tappable rows. */
export function ChevronRightIcon({ color, size = 18, style }: IconProps) {
  const stroke = Math.max(1.75, size * 0.12);
  const arm = size * 0.45;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: 'absolute',
          width: arm,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
          top: size * 0.28,
          left: size * 0.28,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: arm,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
          top: size * 0.52,
          left: size * 0.28,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

/** Small calendar glyph for Period date fields. */
export function CalendarIcon({ color, size = 16, style }: IconProps) {
  const stroke = Math.max(1.25, size * 0.08);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.12,
          right: size * 0.12,
          top: size * 0.22,
          bottom: size * 0.08,
          borderWidth: stroke,
          borderRadius: size * 0.12,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.12,
          right: size * 0.12,
          top: size * 0.38,
          height: stroke,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.28,
          top: size * 0.08,
          width: stroke,
          height: size * 0.22,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.28,
          top: size * 0.08,
          width: stroke,
          height: size * 0.22,
          borderRadius: stroke,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
