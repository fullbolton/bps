import AccountDetails from "./AccountDetails";

export default function AccountPage() {
  return <AccountDetails multiWorkspace={process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED === "true"} conversations={process.env.NEXT_PUBLIC_BPS_CONVERSATION_ENABLED === "true"} />;
}
