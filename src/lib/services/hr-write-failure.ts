/** Only explicit PostgreSQL rollback responses are safe to treat as not saved.
 * After any uncertain attempt, even a later denial cannot disprove an earlier commit. */
export function hrWriteFailure(error:unknown,previouslyUncertain=false):'rejected'|'uncertain'{
 if(previouslyUncertain||!error||typeof error!=='object')return 'uncertain';
 const {code,message}=error as {code?:unknown;message?:unknown};
 return code==='P0001'&&typeof message==='string'&&[
  'HR_ACTIVATION_STALE','HR_ACTIVATION_BLOCKED','ACCESS_MANAGER_REQUIRED','ACCESS_SCOPE',
  'HR_IMPORT_STALE','HR_IMPORT_DECISION','HR_IMPORT_DUPLICATE_CODE',
  'HR_EMPLOYMENT_STALE','HR_EMPLOYMENT_DATE','HR_ACCOUNT_LINK_ACTIVE','HR_MANAGER_HAS_REPORTS','HR_FUTURE_ASSIGNMENTS','HR_MANAGER_REQUIRED','HR_PERIOD_MISSING',
  'HR_EDIT_STALE','HR_LINKED_NAME','HR_CODE_EXISTS','ACCESS_STALE','HR_FORBIDDEN','HR_SCOPE','HR_FUTURE_SCOPE','HR_INPUT',
  'HR_STALE_OR_NOT_TRANSFERABLE','HR_SCOPED_MODE_REQUIRED','HR_MODULE_CLOSED',
 ].includes(message)?'rejected':'uncertain';
}
