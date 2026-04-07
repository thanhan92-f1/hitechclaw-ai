import { ClientShell } from "@/components/mission-control/client-shell";
import { ClientChat } from "@/components/mission-control/client-chat";

export default function ClientChatPage() {
  return (
    <ClientShell>
      <ClientChat />
    </ClientShell>
  );
}