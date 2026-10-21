import { StyleSheet } from 'react-native';

import { fonts, typography } from '@/constants/theme';

import { Text, type TextProps } from './Themed';

/** Body text in DM Sans (default Themed Text already uses body). */
export function BodyText(props: TextProps) {
  return <Text {...props} style={[styles.body, props.style]} />;
}

/** Strong body / labels — DM Sans 600. */
export function StrongText(props: TextProps) {
  return <Text {...props} style={[styles.bodyStrong, props.style]} />;
}

/** Screen / section titles — Fraunces. */
export function TitleText(props: TextProps) {
  return <Text {...props} style={[styles.title, props.style]} />;
}

/** Brand / display — Fraunces. */
export function DisplayText(props: TextProps) {
  return <Text {...props} style={[styles.display, props.style]} />;
}

/** Caption / meta — DM Sans 500. */
export function CaptionText(props: TextProps) {
  return <Text {...props} style={[styles.caption, props.style]} />;
}

/**
 * @deprecated Prefer BodyText / TitleText. Kept for Expo template callers;
 * now uses DM Sans instead of SpaceMono.
 */
export function MonoText(props: TextProps) {
  return <Text {...props} style={[styles.mono, props.style]} />;
}

const styles = StyleSheet.create({
  body: typography.body,
  bodyStrong: typography.bodyStrong,
  title: typography.title,
  display: typography.display,
  caption: typography.caption,
  mono: {
    fontFamily: fonts.body,
  },
});
