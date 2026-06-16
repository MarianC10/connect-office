import { Image, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

type Props = {
  uri?: string | null;
  size?: number;
};

export function UserAvatar({ uri, size = 48 }: Props) {
  if (!uri || uri.trim() === "") {
    return <UserAvatarPlaceholder size={size} />;
  }

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri: uri.trim() }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

export function UserAvatarPlaceholder({ size = 48 }: { size?: number }) {
  return (
    <View
      style={[
        styles.wrap,
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Feather name="user" size={size * 0.45} color="#555" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#e8e8e8",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
