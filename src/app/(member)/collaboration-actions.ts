"use server";
import{randomUUID}from "node:crypto";
import{z}from "zod";
import{revalidatePath}from "next/cache";
import{unstable_rethrow}from "next/navigation";
import{marketplaceContext}from "@/server/services/marketplace";
import{collaborationMutation}from "@/server/services/collaboration";
import{readCollaborationForm,reportCategories,caseRecord,type CollaborationState,type CaseData}from "@/lib/collaboration";
import{minorUnits,colomboInstant,uuid,deliverable,applicationInput}from "@/lib/marketplace";
import type{Json}from "@/lib/database.types";

export async function changeCollaboration(previous:CollaborationState,form:FormData):Promise<CollaborationState>{
 const {values,multi}=readCollaborationForm(form),attempt=Number.isSafeInteger(previous?.attempt)?previous.attempt+1:1;
 const suppliedId=uuid.safeParse(values.request_id??previous?.requestId),safeRequestId=suppliedId.success?suppliedId.data:randomUUID();
 const failure=(message:string):CollaborationState=>({attempt,values,multi,requestId:safeRequestId,message,success:false});
 try{
  const {client}=await marketplaceContext();
  let action=values.action,id:string|undefined=values.id,data:Record<string,Json>={},kind:"support"|"collaboration"="collaboration";
  const requestId=safeRequestId;
  if(action==="mark_notification"){
   const response=await client.rpc("mark_notification",{p_id:uuid.parse(id)}).abortSignal(AbortSignal.timeout(15_000));if(response.error)return failure("We couldn’t mark this notification. Refresh and try again.");
  }else{
   if(action==="terms"){
    const items=[];for(let i=0;i<10;i++)if(values[`format.${i}`]!==undefined)items.push({...deliverable.parse({format:values[`format.${i}`],quantity:values[`quantity.${i}`],acceptance:values[`acceptance.${i}`]}),...(values[`item_id.${i}`]?{id:uuid.parse(values[`item_id.${i}`])}:{})});
    const budget=minorUnits(values.budget??""),due=colomboInstant(values.delivery_deadline??"");if(budget===null||!due||items.length<1)throw new Error("Validation");
    data={expected_version:z.coerce.number().int().positive().parse(values.expected_version),terms:{title:z.string().trim().min(5).max(140).parse(values.title),deliverables:items,budget_minor:budget,currency:"LKR",delivery_deadline:due,revision_allowance:z.coerce.number().int().min(0).max(5).parse(values.revision_allowance)}};
   }else if(action==="confirm")data={version:z.coerce.number().int().positive().parse(values.version)};
   else if(["decline","cancel_pending","request_cancel"].includes(action))data={reason:z.string().trim().min(3).max(3000).parse(values.reason),request_id:requestId};
   else if(action==="withdraw_amendment")data={};
   else if(action==="message")data={request_id:requestId,body:z.string().trim().min(1).max(6000).parse(values.body),attachment_ids:z.array(uuid).max(5).parse(multi.files??[])};
   else if(action==="submit"){
    const items=[];for(let i=0;i<10;i++)if(values[`item_id.${i}`]){
     const urls=[0,1,2].map(j=>values[`url.${i}.${j}`]??"").filter(Boolean);const parsed=applicationInput.shape.work_urls.parse(urls),files=z.array(uuid).max(5).parse(multi[`item_files.${i}`]??[]);
     if(!parsed.length&&!files.length)throw new Error("Evidence required");items.push({item_id:uuid.parse(values[`item_id.${i}`]),urls:parsed,attachment_ids:files,notes:z.string().max(3000).parse(values[`item_notes.${i}`]??"")});
    }
    data={request_id:requestId,agreement_version:z.coerce.number().int().positive().parse(values.version),items,notes:z.string().max(6000).parse(values.notes??"")};
   }else if(action==="review"){
    action=z.enum(["approve","revise"]).parse(values.decision);const selected=z.array(uuid).min(1).max(10).parse(multi.selected_items??[]);
    data={submission_id:uuid.parse(values.submission_id),items:selected.map(item=>{const index=Object.keys(values).find(key=>key.startsWith("item_id.")&&values[key]===item)?.split(".")[1];return {item_id:item,feedback:action==="revise"?z.string().trim().min(3).max(3000).parse(values[`feedback.${index}`]):""};})};
   }else if(action==="respond_cancel")data={request_id:requestId,decision:z.enum(["accept","decline","withdraw"]).parse(values.decision)};
   else if(action==="report"){
    kind="support";const relation=z.enum(["collaboration_id","opportunity_id","member_id"]).parse(values.relation);
    data={request_id:requestId,[relation]:uuid.parse(values.related_id),category:z.enum(reportCategories).parse(values.category),description:z.string().trim().min(10).max(6000).parse(values.description)};id=undefined;
   }else if(["claim","release","resolve","case_cancel","hide_message","moderate_opportunity","member_grant","member_status"].includes(action)){
    kind="support";data={reason:z.string().trim().min(3).max(1000).parse(values.reason)};
    if(action==="resolve")Object.assign(data,{status:z.enum(["resolved","dismissed"]).parse(values.status),outcome:z.string().trim().min(3).max(3000).parse(values.outcome),internal_notes:z.string().max(6000).parse(values.internal_notes??"")});
    if(action==="hide_message")data.message_id=uuid.parse(values.related_id);
    if(action==="member_grant"){Object.assign(data,{clerk_user_id:z.string().regex(/^user_[A-Za-z0-9]{5,240}$/).parse(values.clerk_user_id),role:z.enum(["brand","influencer"]).parse(values.role)});id=undefined;}
    if(action==="member_status")data.status=z.enum(["active","suspended"]).parse(values.status);
   }else return failure("This action is unavailable. Refresh the page.");
   if(id)uuid.parse(id);else if(kind==="collaboration")return failure("Collaboration unavailable.");
   const response=await collaborationMutation(kind,action,id,data);
   if(response.error)return failure(response.error.code==="PT409"?"This record changed. Refresh before trying again.":"We couldn’t confirm this change. Check the current state, your access, evidence and remaining revision allowance before retrying.");
  }
  for(const path of ["/collaborations","/notifications","/reports","/admin","/admin/members","/admin/reports","/admin/audit"])revalidatePath(path);
  revalidatePath("/collaborations/[id]","page");revalidatePath("/opportunities/[id]","page");
  return{attempt,success:true,message:"Saved. Review the current status below.",values:{},multi:{},requestId:randomUUID()};
 }catch(error){unstable_rethrow(error);return failure("Check the entered fields. Use valid HTTPS evidence, complete every item, and include the required explanation. Your draft is preserved below.");}
}
export type CaseState={data:CaseData|null;message:string;reason:string;offset:number};
export async function openSupportCase(_previous:CaseState,form:FormData):Promise<CaseState>{
 const reason=String(form.get("reason")??"").slice(0,1001),offset=Math.max(0,Math.min(Number(form.get("offset"))||0,100000));
 try{
  const {member,client}=await marketplaceContext();if(member.role!=="admin")throw new Error("Access");
  const {data,error}=await client.rpc("support_case",{p_id:uuid.parse(form.get("id")),p_reason:z.string().trim().min(3).max(1000).parse(reason),p_filters:{offset}}).abortSignal(AbortSignal.timeout(15_000));
  if(error)return{data:null,message:"Claim this open report and provide a reason before accessing its private evidence.",reason,offset};
  return{data:caseRecord.parse(data),message:"This case access was recorded.",reason,offset};
 }catch(error){unstable_rethrow(error);return{data:null,message:"This case is unavailable. Check your access and reason, then try again.",reason,offset};}
}
