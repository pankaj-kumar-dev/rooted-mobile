import React from "react";
import { Alert, Text, View } from "react-native";
import { Button, Card, ScreenScroll } from "../components/ui";
import { useRooted } from "../store/RootedProvider";
import { space, type } from "../theme";
import app from "../../app.json";

export function SettingsScreen() {
  const { deleteAllData, state } = useRooted();

  function confirmDelete() {
    Alert.alert(
      "Delete all data?",
      "This permanently removes every habit, check-in and backup ROOTED keeps on this device. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete everything", style: "destructive", onPress: () => void deleteAllData() },
      ],
    );
  }

  return (
    <ScreenScroll>
      <View style={{ gap: space.xs }}>
        <Text style={type.eyebrow}>YOUR SPACE</Text>
        <Text style={type.display}>Quiet by design.</Text>
      </View>

      <Card>
        <Text style={type.heading}>Privacy</Text>
        <Text style={type.muted}>
          ROOTED works without an account. Your habits and check-ins are stored only on this device and are never sent to a server. There are no analytics. Uninstalling the app or clearing its data removes them, and nothing is backed up elsewhere.
        </Text>
      </Card>

      <Card>
        <Text style={type.heading}>How ratings work</Text>
        <Text style={type.muted}>
          Each habit starts at 0. A good day adds 1, a slip-up subtracts 1, and a missed or empty day changes nothing. Ratings can go below zero, and earlier days are never erased. One outcome per habit per day, and you can change any past day.
        </Text>
      </Card>

      <Card>
        <Text style={type.heading}>About ROOTED</Text>
        <Text style={type.muted}>
          Break the pattern. Grow beyond it. A personal habit-tracking and reflection tool. It is not medical treatment and does not replace professional support.
        </Text>
        <Text style={type.small}>
          Version {app.expo.version} · {state.habits.length} habit{state.habits.length === 1 ? "" : "s"} saved on this device
        </Text>
      </Card>

      <Card>
        <Text style={type.heading}>Your data</Text>
        <Text style={type.muted}>Deleting removes everything ROOTED stores on this device, including backups.</Text>
        <Button label="Delete all data" variant="danger" onPress={confirmDelete} />
      </Card>
    </ScreenScroll>
  );
}
