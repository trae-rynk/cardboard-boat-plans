/**
 * Web stub for react-native-css-interop
 *
 * react-native-css-interop is a native-only styling package used by NativeWind
 * to apply CSS/Tailwind classes in React Native environments. On web, NativeWind
 * uses standard CSS instead, so this package is never needed.
 *
 * This stub exports no-op implementations of the package's public API so that
 * Metro can resolve the module on web without attempting to bundle the real
 * package (which references native modules and a build-time cache file that
 * doesn't exist during the web export).
 */

import type { ComponentType } from "react";

// cssInterop: wraps a component to accept className and map it to style props.
// On web, NativeWind handles this natively — no-op is safe.
export const cssInterop = (component: ComponentType<any>, _mapping?: object) =>
  component;

// remapProps: remaps prop names on a component (e.g. className → style).
// On web this is a no-op; the component is returned unchanged.
export const remapProps = (component: ComponentType<any>, _mapping?: object) =>
  component;

// interopComponents: registry of components that have been wrapped.
export const interopComponents = new Map<ComponentType<any>, ComponentType<any>>();

// StyleSheet: mirrors the React Native StyleSheet API with CSS-interop extras.
export const StyleSheet = {
  create: <T extends object>(styles: T): T => styles,
  flatten: (style: any) => style,
  hairlineWidth: 1,
  absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  absoluteFillObject: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
};

// vars: creates CSS custom property mappings for theming.
export const vars = (_variables: Record<string, string>) => ({});

// useColorScheme: returns the current color scheme.
export const useColorScheme = () => ({
  colorScheme: "light" as "light" | "dark",
  setColorScheme: (_scheme: "light" | "dark" | "system") => {},
  toggleColorScheme: () => {},
});

// useUnstableNativeVariable: reads a native CSS variable value.
export const useUnstableNativeVariable = (_name: string) => undefined;

// colorScheme: imperative color scheme controls.
export const colorScheme = {
  get: () => "light" as "light" | "dark",
  set: (_scheme: "light" | "dark" | "system") => {},
  toggle: () => {},
};

export default {};
