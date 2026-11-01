import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space, TOUCH, type } from "../theme";

/** Scrolling screen body that respects the top safe area. The tab bar handles the bottom inset. */
export function ScreenScroll({ children, bottomPad = space.xxl }: { children: ReactNode; bottomPad?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: bottomPad,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = "primary", disabled, busy, accessibilityHint, style }: ButtonProps) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        variant === "quiet" && styles.buttonQuiet,
        pressed && styles.pressed,
        off && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === "primary" && { color: colors.onGreen },
          variant === "secondary" && { color: colors.green },
          variant === "danger" && { color: colors.slip },
          variant === "quiet" && { color: colors.textMuted },
        ]}
      >
        {busy ? "Working…" : label}
      </Text>
    </Pressable>
  );
}

export function SectionHeader({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={type.heading} accessibilityRole="header">{title}</Text>
      {trailing ? <Text style={type.small}>{trailing}</Text> : null}
    </View>
  );
}

export function Banner({
  text, tone = "info", actionLabel, onAction, onDismiss,
}: {
  text: string;
  tone?: "info" | "error";
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <View
      style={[styles.banner, tone === "error" && styles.bannerError]}
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
    >
      <Text style={[type.body, styles.bannerText]}>{text}</Text>
      <View style={styles.bannerActions}>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" style={styles.bannerBtn}>
            <Text style={styles.bannerBtnText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.bannerBtn}>
            <Text style={styles.bannerBtnText}>Dismiss</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface FieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  optional?: boolean;
  hint?: string;
}

export function Field({ label, optional, hint, multiline, maxLength, value, ...rest }: FieldProps) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.eyebrow}>
        {label.toUpperCase()}
        {optional ? <Text style={{ color: colors.textMuted, fontWeight: "400" }}>  OPTIONAL</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.neutral}
        value={value}
        maxLength={maxLength}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMulti]}
        selectionColor={colors.green}
        {...rest}
      />
      {hint || maxLength ? (
        <Text style={type.small}>
          {hint ?? ""}
          {maxLength && value !== undefined && value.length > maxLength * 0.8 ? `  ${value.length}/${maxLength}` : ""}
        </Text>
      ) : null}
    </View>
  );
}

/** Bottom sheet. Closing is always possible via the backdrop, the Close button or the Android back button. */
export function Sheet({
  visible, onClose, title, children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.sheetRoot} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.sheetHeader}>
            <Text style={[type.title, { flex: 1 }]} accessibilityRole="header">{title}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.closeBtn}
            >
              <Text style={[type.heading, { color: colors.textMuted }]}>Close</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.md }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  button: {
    minHeight: TOUCH,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  buttonPrimary: { backgroundColor: colors.green },
  buttonSecondary: { backgroundColor: "transparent", borderColor: colors.borderStrong },
  buttonDanger: { backgroundColor: "transparent", borderColor: colors.slipDeep },
  buttonQuiet: { backgroundColor: "transparent" },
  buttonText: { fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  banner: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: space.md,
    gap: space.sm,
  },
  bannerError: { borderColor: colors.slip, backgroundColor: "#2a1714" },
  bannerText: { fontSize: 14, lineHeight: 20 },
  bannerActions: { flexDirection: "row", gap: space.lg },
  bannerBtn: { minHeight: 32, justifyContent: "center" },
  bannerBtnText: { color: colors.green, fontWeight: "700", fontSize: 14 },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: TOUCH,
    fontSize: 16,
  },
  inputMulti: { minHeight: 84, textAlignVertical: "top" },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    maxHeight: "90%",
    gap: space.md,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: space.md },
  closeBtn: { minHeight: TOUCH, justifyContent: "center" },
  stat: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: space.md,
    gap: 2,
  },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "700" },
});
