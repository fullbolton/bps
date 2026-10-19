/** Only explicit PostgreSQL rollback responses are safe to treat as not saved.
 * After any uncertain attempt, even a later denial cannot disprove an earlier commit. */
export function hrWriteFailure(error:unknown,previouslyUncertain=false):'rejected'|'uncertain'{
 if(previouslyUncertain||!error||typeof error!=='object')return 'uncertain';
 const {code,message}=error as {code?:unknown;message?:unknown};
 return code==='P0001'&&typeof message==='string'&&[
  'ACCESS_STALE','HR_FORBIDDEN','HR_SCOPE','HR_FUTURE_SCOPE','HR_INPUT',
  'HR_STALE_OR_NOT_TRANSFERABLE','HR_SCOPED_MODE_REQUIRED','HR_MODULE_CLOSED',
 ].includes(message)?'rejected':'uncertain';
}
