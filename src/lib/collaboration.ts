import {z}from "zod";
import {deliverable,uuid,opportunityRecord,memberProfile}from "./marketplace.ts";
export const agreementTerms=z.object({title:z.string(),deliverables:z.array(deliverable.extend({id:uuid.optional()})).min(1).max(10),budget_minor:z.number().int().positive(),currency:z.literal("LKR"),delivery_deadline:z.string(),revision_allowance:z.number().int().min(0).max(5),brand_id:uuid,influencer_id:uuid});
export type AgreementTerms=z.infer<typeof agreementTerms>;
export const collaborationRecord=z.object({id:uuid,opportunity_id:uuid,brand_id:uuid,influencer_id:uuid,status:z.string(),terms:agreementTerms,terms_version:z.number(),current_proposal:z.number().nullable(),effective_version:z.number().nullable(),agreement_expires_at:z.string(),activated_at:z.string().nullable(),latest_submission:uuid.nullable(),created_at:z.string()});
export const versionRecord=z.object({collaboration_id:uuid,version:z.number(),kind:z.string(),terms:agreementTerms,status:z.string(),proposed_by:uuid,brand_confirmed_at:z.string().nullable(),influencer_confirmed_at:z.string().nullable(),accepted_at:z.string().nullable(),created_at:z.string()});
export const messageRecord=z.object({id:uuid,author_id:uuid,body:z.string(),hidden_at:z.string().nullable(),created_at:z.string()});
export const submittedItem=z.object({item_id:uuid,urls:z.array(z.string()).max(3),attachment_ids:z.array(uuid).max(5),notes:z.string()});
export const reviewRecord=z.object({submission_id:uuid,item_id:uuid,decision:z.string(),feedback:z.string(),created_at:z.string()});
export const submissionRecord=z.object({id:uuid,version:z.number(),agreement_version:z.number(),author_id:uuid,items:z.array(submittedItem),notes:z.string(),created_at:z.string(),reviews:z.array(reviewRecord).optional()});
export const fileRecord=z.object({id:uuid,filename:z.string(),state:z.string(),size_bytes:z.number().nullable(),message_id:uuid.nullable(),submission_id:uuid.nullable(),uploaded_by:uuid});
export type CollaborationFile=z.infer<typeof fileRecord>;
export const cancellationRecord=z.object({id:uuid,requested_by:uuid,reason:z.string(),status:z.string(),created_at:z.string(),support_after:z.string(),responded_by:uuid.nullable(),responded_at:z.string().nullable()});
export const auditRecord=z.object({id:uuid,actor_id:uuid.nullable(),kind:z.string(),reason:z.string(),created_at:z.string()});
export const collaborationDetail=z.object({collaboration:collaborationRecord,versions:z.array(versionRecord),items:z.array(z.object({id:uuid,revisions_used:z.number(),revision_pending:z.boolean()})),messages:z.array(messageRecord),message_count:z.number(),submissions:z.array(submissionRecord),reviews:z.array(reviewRecord),cancellations:z.array(cancellationRecord),files:z.array(fileRecord),stored_bytes:z.number(),history:z.array(auditRecord)});
export const reportCategories=["inappropriate_content","misleading_profile_brief","access_safety","delivery_disagreement","other"]as const;
export const reportRecord=z.object({id:uuid,category:z.string(),description:z.string(),status:z.string(),outcome:z.string(),collaboration_id:uuid.nullable(),opportunity_id:uuid.nullable(),member_id:uuid.nullable(),created_at:z.string()});
export const caseRecord=z.object({report:reportRecord.extend({assigned_admin:uuid.nullable(),internal_notes:z.string(),reporter_id:uuid}),collaboration:collaborationRecord.nullable(),opportunity:opportunityRecord.nullable(),member:memberProfile.nullable(),messages:z.array(messageRecord),message_count:z.number(),submissions:z.array(submissionRecord),submission_count:z.number(),versions:z.array(versionRecord),version_count:z.number(),files:z.array(z.object({id:uuid,filename:z.string(),size_bytes:z.number().nullable(),message_id:uuid.nullable(),submission_id:uuid.nullable()}))});
export type CaseData=z.infer<typeof caseRecord>;
export type CollaborationState={attempt:number;success:boolean;message:string;values:Record<string,string>;multi:Record<string,string[]>;requestId:string};
export function readCollaborationForm(form:FormData){
 const values:Record<string,string>={},multi:Record<string,string[]>={};
 const allowed=new Set(["action","id","request_id","version","expected_version","submission_id","reason","body","notes","title","budget","delivery_deadline","revision_allowance","decision","category","description","relation","related_id","status","outcome","internal_notes","clerk_user_id","role","file_id","report"]);
 for(const [key,value]of form.entries()){
  if(typeof value!=="string")continue;
  if(allowed.has(key)||/^(format|quantity|acceptance|item_id|item_notes|feedback|url)[.]\d(?:[.]\d)?$/.test(key))values[key]=value.slice(0,6001);
  if(key==="selected_items"||key==="files"||/^item_files[.]\d$/.test(key))multi[key]=form.getAll(key).filter((v):v is string=>typeof v==="string").slice(0,key==="selected_items"?11:6);
 }
 return {values,multi};
}
