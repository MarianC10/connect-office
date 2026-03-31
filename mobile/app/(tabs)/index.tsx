import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coworking App</Text>

      <Link href="/login" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Go to Login</Text>
        </Pressable>
      </Link>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    marginBottom: 20,
    backgroundColor: "red",
    fontWeight: "700",
  },
  text: {
    fontSize: 28,
    color: "red",
    fontWeight: "700",
  },
  button: {
    backgroundColor: "green",
    padding: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "blue",
  },
});