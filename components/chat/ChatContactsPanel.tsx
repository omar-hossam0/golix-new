import type { FormEvent } from "react";
import { Check, Loader2, Plus, Search, Shield, UserPlus, UserRound, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { ContactSection } from "@/components/chat/ContactSection";
import { contactRoleLabel, formatContactSubtitle } from "@/components/chat/chatFormatters";
import type { ChatCopy, ChatRole, Contact, ContactsResponse } from "@/components/chat/chatTypes";

type ChatContactsPanelProps = {
  role: ChatRole;
  t: ChatCopy;
  query: string;
  setQuery: (value: string) => void;
  groupComposerOpen: boolean;
  setGroupComposerOpen: (open: boolean) => void;
  createChatGroup: (event: FormEvent<HTMLFormElement>) => void;
  resetGroupComposer: () => void;
  groupName: string;
  setGroupName: (value: string) => void;
  groupSearch: string;
  setGroupSearch: (value: string) => void;
  groupMemberUserIds: string[];
  filteredGroupCandidateContacts: Contact[];
  groupCandidateContacts: Contact[];
  toggleGroupMember: (userId: string) => void;
  creatingGroup: boolean;
  filteredContacts: ContactsResponse;
  openConversation: (contact: Contact) => void;
};

export function ChatContactsPanel({
  role,
  t,
  query,
  setQuery,
  groupComposerOpen,
  setGroupComposerOpen,
  createChatGroup,
  resetGroupComposer,
  groupName,
  setGroupName,
  groupSearch,
  setGroupSearch,
  groupMemberUserIds,
  filteredGroupCandidateContacts,
  groupCandidateContacts,
  toggleGroupMember,
  creatingGroup,
  filteredContacts,
  openConversation,
}: ChatContactsPanelProps) {
  return (
    <aside className="goalix-chat-panel goalix-chat-contacts">
      <div className="goalix-chat-panel-head">
        {role === "admin" ? <Shield className="goalix-chat-head-icon" /> : role === "coach" ? <Users className="goalix-chat-head-icon" /> : <UserRound className="goalix-chat-head-icon" />}
        <h2>{t.contacts}</h2>
      </div>
      <div className="goalix-chat-search-wrap">
        <div className="goalix-chat-search">
          <Search />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="goalix-chat-search-input"
            placeholder={t.search}
          />
        </div>
      </div>
      {role === "coach" && (
        <div className="goalix-chat-group-maker">
          {!groupComposerOpen ? (
            <Button
              type="button"
              size="sm"
              className="goalix-chat-new-group-button"
              onClick={() => setGroupComposerOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t.newGroup}
            </Button>
          ) : (
            <form onSubmit={createChatGroup} className="goalix-chat-group-form">
              <div className="goalix-chat-group-form-head">
                <div>
                  <strong>{t.newChatGroup}</strong>
                  <span>{groupMemberUserIds.length} {t.selected}</span>
                </div>
                <button
                  type="button"
                  onClick={resetGroupComposer}
                  title={t.closeGroupCreator}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={120}
                placeholder={t.groupName}
                className="goalix-chat-group-input"
              />
              <div className="goalix-chat-search is-group">
                <Search />
                <Input
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                  className="goalix-chat-search-input"
                  placeholder={t.groupSearch}
                />
              </div>
              <div className="goalix-chat-group-member-list">
                {filteredGroupCandidateContacts.map((contact) => {
                  const selectedMember = groupMemberUserIds.includes(
                    contact.user_id,
                  );
                  return (
                    <label
                      key={`${contact.type}-${contact.user_id}`}
                      className={cn(
                        "goalix-chat-group-member",
                        selectedMember && "is-selected",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMember}
                        onChange={() => toggleGroupMember(contact.user_id)}
                      />
                      <Avatar className="goalix-chat-avatar is-contact">
                        <AvatarFallback>
                          {getInitials(contact.name)}
                        </AvatarFallback>
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
                      <span className="goalix-chat-group-check">
                        {selectedMember && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </label>
                  );
                })}
                {filteredGroupCandidateContacts.length === 0 && (
                  <div className="goalix-chat-empty-state is-compact">
                    {groupCandidateContacts.length === 0 ? t.noPeopleAvailable : t.noContacts}
                  </div>
                )}
              </div>
              <div className="goalix-chat-group-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={resetGroupComposer}
                >
                  {t.cancel}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    creatingGroup ||
                    !groupName.trim() ||
                    groupMemberUserIds.length === 0
                  }
                >
                  {creatingGroup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {t.create}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      <div className="goalix-chat-scroll">
        {role === "admin" && (
          <ContactSection
            title={t.coaches}
            contacts={filteredContacts.coaches || []}
            onOpen={openConversation}
            t={t}
          />
        )}
        {role === "coach" && (
          <ContactSection
            title={t.admins}
            contacts={filteredContacts.admins || []}
            onOpen={openConversation}
            t={t}
          />
        )}
        {role === "coach" && (
          <ContactSection
            title={t.coaches}
            contacts={filteredContacts.coaches || []}
            onOpen={openConversation}
            t={t}
          />
        )}
        {role === "coach" && (
          <ContactSection
            title={t.players}
            contacts={filteredContacts.players || []}
            onOpen={openConversation}
            t={t}
          />
        )}
        {role === "coach" && (
          <ContactSection
            title={t.parents}
            contacts={filteredContacts.parents || []}
            onOpen={openConversation}
            t={t}
          />
        )}
        {role === "player" && (
          <ContactSection
            title={t.coaches}
            contacts={filteredContacts.coaches || []}
            onOpen={openConversation}
            t={t}
          />
        )}
        {role === "parent" && (
          <ContactSection
            title={t.coaches}
            contacts={filteredContacts.coaches || []}
            onOpen={openConversation}
            t={t}
          />
        )}
        {role === "admin" && (
          <ContactSection
            title={t.players}
            contacts={filteredContacts.players || []}
            onOpen={openConversation}
            t={t}
          />
        )}
      </div>
    </aside>
  );
}
