import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TabBar, type Tab } from "./src/components/TabBar";
import { Banner } from "./src/components/ui";
import { HabitDetailScreen } from "./src/screens/HabitDetailScreen";
import { HabitsScreen } from "./src/screens/HabitsScreen";
import { JourneyScreen } from "./src/screens/JourneyScreen";
import { RecoveryScreen } from "./src/screens/RecoveryScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import { RootedProvider, useRooted } from "./src/store/RootedProvider";
import { colors, space } from "./src/theme";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootedProvider>
        <Shell />
      </RootedProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { boot } = useRooted();
  if (boot.kind === "loading") {
    return (
      <View style={styles.center} accessibilityLabel="Loading ROOTED">
        <Text style={styles.brand}>ROOTED</Text>
        <ActivityIndicator color={colors.green} style={{ marginTop: space.lg }} />
      </View>
    );
  }
  if (boot.kind === "recovery") {
    return (
      <View style={styles.root}>
        <RecoveryScreen result={boot.result} />
        <Messages />
      </View>
    );
  }
  return <MainApp />;
}

function MainApp() {
  const [tab, setTab] = useState<Tab>("Today");
  const [habitId, setHabitId] = useState<string | null>(null);

  // Android back: close the habit page, then return to Today, then let the system exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (habitId) {
        setHabitId(null);
        return true;
      }
      if (tab !== "Today") {
        setTab("Today");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [habitId, tab]);

  return (
    <View style={styles.root}>
      <View style={styles.flex}>
        {habitId ? (
          <HabitDetailScreen habitId={habitId} onBack={() => setHabitId(null)} />
        ) : tab === "Today" ? (
          <TodayScreen onOpenHabit={setHabitId} onGoTab={setTab} />
        ) : tab === "Journey" ? (
          <JourneyScreen onOpenHabit={setHabitId} onGoTab={setTab} />
        ) : tab === "Habits" ? (
          <HabitsScreen onOpenHabit={setHabitId} />
        ) : (
          <SettingsScreen />
        )}
      </View>
      <Messages />
      {habitId ? null : <TabBar active={tab} onSelect={setTab} />}
    </View>
  );
}

/** Save failures, one-time migration notes and transient notices. Never hides an unsaved-data warning. */
function Messages() {
  const { saveError, retrySave, notice, dismissNotice, migrationSummary, dismissMigrationSummary } = useRooted();

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismissNotice, notice.tone === "error" ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [notice, dismissNotice]);

  if (!saveError && !notice && !migrationSummary) return null;
  return (
    <View style={styles.messages} pointerEvents="box-none">
      {saveError ? (
        <Banner tone="error" text={`Not saved. ${saveError} Your latest change is only on screen for now.`} actionLabel="Retry saving" onAction={retrySave} />
      ) : null}
      {notice ? <Banner tone={notice.tone} text={notice.text} onDismiss={dismissNotice} /> : null}
      {migrationSummary ? <Banner text={migrationSummary} onDismiss={dismissMigrationSummary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  brand: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: 6 },
  messages: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm, backgroundColor: colors.bg },
});
