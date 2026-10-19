import AccountDetails from "./AccountDetails";

export default function AccountPage() {
  return <AccountDetails unifiedInbox={process.env.NEXT_PUBLIC_BPS_WORKSPACE_INBOX_ENABLED === "true"} conversations={process.env.NEXT_PUBLIC_BPS_CONVERSATION_ENABLED === "true"} />;
}
