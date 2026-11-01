import React from "react";
import { Alert, Text, View } from "react-native";
import { Button, Card, ScreenScroll } from "../components/ui";
import { useRooted, type RecoveryResult } from "../store/RootedProvider";
import { space, type } from "../theme";

/** Shown instead of the app when stored data cannot be read. Nothing is overwritten from here without consent. */
export function RecoveryScreen({ result }: { result: RecoveryResult }) {
  const { retryLoad, startFresh } = useRooted();

  const confirmFresh = () =>
    Alert.alert(
      "Start with an empty ROOTED?",
      "Your unreadable data is backed up on this device first, but the app will show no habits or history.",
      [{ text: "Cancel", style: "cancel" }, { text: "Start fresh", style: "destructive", onPress: () => void startFresh() }],
    );

  return (
    <ScreenScroll>
      <View style={{ gap: space.xs }}>
        <Text style={type.eyebrow}>ROOTED</Text>
        <Text style={type.display}>We couldn&apos;t read your data.</Text>
      </View>
      <Card>
        {result.status === "corrupt" ? (
          <>
            <Text style={type.body}>
              Your saved data looks damaged ({result.reason}) so ROOTED has not opened it. Nothing was deleted or replaced.
              {result.backupKey ? " A copy was set aside on this device." : " A backup copy could not be made, so starting fresh is disabled to protect your data."}
            </Text>
            <Button label="Try again" onPress={retryLoad} />
            <Button label="Start fresh" variant="danger" disabled={!result.backupKey} onPress={confirmFresh} />
          </>
        ) : result.status === "unsupported" ? (
          <>
            <Text style={type.body}>
              {result.reason} Update ROOTED to open it. Nothing was changed.
            </Text>
            <Button label="Try again" onPress={retryLoad} />
          </>
        ) : (
          <>
            <Text style={type.body}>
              Storage on this device could not be read or written. Nothing was changed. Free up some space or restart the app, then try again.
            </Text>
            <Button label="Try again" onPress={retryLoad} />
          </>
        )}
      </Card>
    </ScreenScroll>
  );
}
