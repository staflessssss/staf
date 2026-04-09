import { redirect } from "next/navigation";

export default function LegacyClientConversationsRedirect() {
  redirect("/client/dialogs");
}
