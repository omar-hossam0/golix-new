import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { ChatCopy, Contact } from "@/components/chat/chatTypes";
import { contactRoleLabel, formatContactSubtitle } from "@/components/chat/chatFormatters";

export function ContactSection({
  title,
  contacts,
  onOpen,
  t,
}: {
  title: string;
  contacts: Contact[];
  onOpen: (contact: Contact) => void;
  t: ChatCopy;
}) {
  return (
    <section className="goalix-chat-contact-section">
      <h3>{title}</h3>
      <div className="goalix-chat-contact-list">
        {contacts.map((contact) => (
          <button
            key={`${contact.type}-${contact.id}-${contact.player_id || "direct"}`}
            onClick={() => onOpen(contact)}
            className="goalix-chat-contact-card"
          >
            <Avatar className="goalix-chat-avatar is-contact">
              <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
            </Avatar>
            <span className="goalix-chat-list-copy">
              <span className="goalix-chat-list-title">
                {contact.name}
                <Badge variant="outline" className="goalix-chat-role-badge">
                  {contactRoleLabel(contact.type, t)}
                </Badge>
              </span>
              {contact.subtitle && (
                <span className="goalix-chat-list-subtitle">
                  {formatContactSubtitle(contact.subtitle, t)}
                </span>
              )}
            </span>
          </button>
        ))}
        {contacts.length === 0 && (
          <div className="goalix-chat-empty-state">{t.noContacts}</div>
        )}
      </div>
    </section>
  );
}
