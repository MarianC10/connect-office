import { Redirect } from "expo-router";

export default function OwnerTabRedirect() {
  return <Redirect href={"/owner" as any} />;
}