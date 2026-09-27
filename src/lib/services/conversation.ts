import type { SupabaseClient } from '@supabase/supabase-js';
import { validateCommentCommand, parseCommentReceipt } from '@/lib/operations/conversation-command';

/** Authorization belongs to the RPC. Unknown outcomes retain the same caller-owned command ID. */
export async function sendRequestComment(client: SupabaseClient, input: unknown): Promise<{ messageId: string }> {
  const command = validateCommentCommand(input);
  const { data, error } = await client.rpc('ops_comment_send', {
    p_actor_id: command.actorId, p_tenant_id: command.tenantId,
    p_command_id: command.commandId, p_request_id: command.requestId,
    p_body: command.body, p_parent_id: command.parentId, p_mentions: command.mentionIds,
  });
  if (error) throw error;
  return parseCommentReceipt(data, command);
}
