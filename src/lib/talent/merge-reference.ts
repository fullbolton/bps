import {checkTalentScope,type TalentScope} from './people';
import {validateMergeCommand,type MergeCommand} from './merge-review';
export function mergeReferenceKey(scope:TalentScope){const s=checkTalentScope(scope);return `bps:person-merge:v1:${s.actorId}:${s.tenantId}`;}
export function encodeMergeReference(scope:TalentScope,command:MergeCommand){return JSON.stringify({version:1,scope:checkTalentScope(scope),command:validateMergeCommand(command)});}
export function decodeMergeReference(raw:string,scope:TalentScope):MergeCommand{
 const value=JSON.parse(raw);if(!value||value.version!==1||value.scope?.actorId!==scope.actorId||value.scope?.tenantId!==scope.tenantId)throw Error('MERGE_REFERENCE_INVALID');
 return validateMergeCommand(value.command);
}
