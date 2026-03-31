import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput placeholder="Email" style={styles.input} />
      <TextInput placeholder="Password" secureTextEntry style={styles.input} />

      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Sign In</Text>
      </Pressable>

      {/* <Link href="/register" style={styles.link}>
        Create an account
      </Link> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    backgroundColor: "red",
    fontWeight: "700",
    marginBottom: 24,
    textAlign: "center",
  },
  text: {
    fontSize: 28,
    color: "red",
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "black",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  link: {
    marginTop: 16,
    textAlign: "center",
  },
});