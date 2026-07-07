import { Check, CheckCheck } from "lucide-react";
import type { ChatCopy, Message } from "@/components/chat/chatTypes";

export function MessageReceipt({ message, t }: { message: Message; t: ChatCopy }) {
  if (message.read_at) {
    return (
      <span title={t.read} className="inline-flex text-cyan-300">
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (message.delivered_at) {
    return (
      <span title={t.delivered} className="inline-flex text-slate-400">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }

  return null;
}
