import { useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function OfficeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Office detail coming soon</Text>
      <Text style={styles.sub}>ID: {id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0F0F13" },
  text: { fontSize: 18, fontWeight: "700", color: "#F0F0F0" },
  sub: { fontSize: 13, color: "#8888A0", marginTop: 8 },
});