import "server-only";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {z} from "zod";
import type {Database,Json} from "../../lib/database.types.ts";
import {AttachmentError,MAX_ATTACHMENT_BYTES,scanAttachment} from "./clamav.ts";
import {attachmentHash,prepareAttachment,safeAttachmentName,verifyAttachment} from "./content.ts";
import {randomUUID} from "node:crypto";

const QUARANTINE="collaboration-quarantine",CLEAN="collaboration-files";
const fileAccess=z.object({id:z.string().uuid(),collaboration_id:z.string().uuid(),filename:z.string().max(160),size_bytes:z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),sha256:z.string().regex(/^[a-f0-9]{64}$/),content_type:z.enum(["image/webp","application/pdf"])});
function path(collaboration:string,id:string){return `${z.string().uuid().parse(collaboration)}/${z.string().uuid().parse(id)}`;}
/** This is the ONLY module reading the worker credential or creating its client.
 * No raw client is exported. Every operation is fixed-bucket/fixed-path and is
 * preceded by caller-JWT authorization, except trusted orphan cleanup. */
function workerClient(signal?:AbortSignal){
 const key=process.env.SUPABASE_ATTACHMENT_WORKER_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!key||!url||(!key.startsWith("sb_secret_")&&!key.startsWith("eyJ")))throw new AttachmentError("File uploads are unavailable. Please try again later.");
 return createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store",signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),...(signal?[signal]:[]),AbortSignal.timeout(20_000)])})}});
}
export function attachmentsConfigured(){return Boolean(process.env.SUPABASE_ATTACHMENT_WORKER_KEY&&process.env.CLAMAV_HOST);}
async function worker(action:string,id?:string,data:Json={},signal?:AbortSignal){
 const response=await workerClient(signal).rpc("attachment_worker",{p_action:action,...(id?{p_id:id}:{}),p_data:data}).abortSignal(AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15_000)]));
 if(response.error)throw new AttachmentError("We couldn’t confirm the file’s status. Refresh before trying again.");return response.data;
}
function absent(error:{status?:number;statusCode?:string;code?:unknown}|null){return Boolean(error&&(error.status===404||error.statusCode==="404"||error.code==="NoSuchKey"));}
async function removeAndConfirm(bucket:typeof CLEAN|typeof QUARANTINE,key:string,signal?:AbortSignal){
 signal?.throwIfAborted();const storage=workerClient(signal).storage.from(bucket);const removed=await storage.remove([key]);if(removed.error)return false;
 const check=await storage.info(key);return absent(check.error);
}
async function purge(id:string,collaboration:string){
 // Reject locks the reservation first: if a concurrent message linked it, this
 // fails and NO bytes are deleted. Never delete on an uncertain state response.
 await worker("reject",id);
 const key=path(collaboration,id);
 const [quarantine_removed,clean_removed]=await Promise.all([removeAndConfirm(QUARANTINE,key),removeAndConfirm(CLEAN,key)]);
 if(!quarantine_removed||!clean_removed)throw new AttachmentError("File cleanup is pending. Its allowance remains reserved.");
 await worker("purged",id,{quarantine_removed,clean_removed});
}
export async function uploadAttachment(client:SupabaseClient<Database>,collaboration:string,name:string,incoming:Uint8Array,requestSignal?:AbortSignal){
 const deadline=AbortSignal.any([...(requestSignal?[requestSignal]:[]),AbortSignal.timeout(90_000)]);
 if(!attachmentsConfigured())throw new AttachmentError("File uploads are unavailable. Please try again later.");
 const allowed=await client.rpc("collaboration_read",{p_kind:"detail",p_id:collaboration}).abortSignal(AbortSignal.any([deadline,AbortSignal.timeout(15_000)]));
 if(allowed.error||!allowed.data)throw new AttachmentError("Only active participants can upload files here.");
 // Scan actual incoming bytes before exposing a decoder to them. Nothing is
 // persisted or shared if this first scan is not an exact clean result.
 const firstProof=await scanAttachment(incoming,undefined,deadline);
 const prepared=await prepareAttachment(incoming),id=randomUUID();
 const filename=safeAttachmentName(name,prepared.extension);
 deadline.throwIfAborted();
 const reservation=await client.rpc("collaboration_command",{p_action:"reserve_file",p_id:collaboration,p_data:{request_id:id,filename,size:Math.max(incoming.length,prepared.bytes.length)}}).abortSignal(AbortSignal.any([deadline,AbortSignal.timeout(15_000)]));
 if(reservation.error)throw new AttachmentError("We couldn’t reserve file space. Check your access and the collaboration’s remaining allowance.");
 const key=path(collaboration,id);let finalized=false;
 try {
  const originalType=prepared.contentType==="application/pdf"?"application/pdf":incoming[0]===0xff?"image/jpeg":incoming[0]===137?"image/png":"image/webp";
  deadline.throwIfAborted();
  const quarantined=await workerClient(deadline).storage.from(QUARANTINE).upload(key,incoming,{contentType:originalType,cacheControl:"0",upsert:false});
  if(quarantined.error)throw new AttachmentError("We couldn’t store the quarantined file. Please try again.");
  await worker("quarantine",id,{},deadline);
  // PDF promotion uses identical bytes/hash and the original scan attestation.
  // Image output is different bytes and must pass its own real scanner request.
  const proof=attachmentHash(incoming)===attachmentHash(prepared.bytes)?firstProof:await scanAttachment(prepared.bytes,undefined,deadline);
  deadline.throwIfAborted();
  const promoted=await workerClient(deadline).storage.from(CLEAN).upload(key,prepared.bytes,{contentType:prepared.contentType,cacheControl:"0",upsert:false});
  if(promoted.error)throw new AttachmentError("We couldn’t save the prepared file. Please try again.");
  const quarantine_removed=await removeAndConfirm(QUARANTINE,key,deadline);
  if(!quarantine_removed)throw new AttachmentError("File cleanup is pending. The file is not available yet.");
  deadline.throwIfAborted();
  await worker("finalize",id,{size:prepared.bytes.length,sha256:attachmentHash(prepared.bytes),content_type:prepared.contentType,...proof,quarantine_removed},deadline);
  finalized=true;return {id,filename,size:prepared.bytes.length};
 }catch(error){
  if(!finalized){try{await worker("reject",id);}catch{/* Never delete on uncertainty; durable cleanup retains quota for 24h. */}}
  throw error instanceof AttachmentError?error:new AttachmentError("We couldn’t confirm the upload. Refresh before trying again.");
 }
}
export async function discardAttachment(client:SupabaseClient<Database>,collaboration:string,id:string){
 const result=await client.rpc("collaboration_command",{p_action:"discard_file",p_id:collaboration,p_data:{file_id:id}}).abortSignal(AbortSignal.timeout(15_000));
 if(result.error)throw new AttachmentError("Only your unshared file can be discarded.");
 await purge(id,collaboration);
}
export async function downloadAttachment(client:SupabaseClient<Database>,id:string,report?:string,reason?:string){
 async function authorize(){
  const {data,error}=await client.rpc("attachment_access",{p_id:id,...(report?{p_report:report,p_reason:reason??""}:{})}).abortSignal(AbortSignal.timeout(15_000));
  if(error)throw new AttachmentError("This file is unavailable for your account.");return data===null?null:fileAccess.parse(data);
 }
 const access=await authorize();if(!access)return null;
 const storage=workerClient().storage.from(CLEAN),key=path(access.collaboration_id,access.id),info=await storage.info(key);
 if(absent(info.error))return null;if(info.error||!info.data||info.data.size!==access.size_bytes)throw new AttachmentError("This file could not be verified.");
 const result=await storage.download(key,{cacheNonce:access.sha256},{cache:"no-store"});
 if(result.error||!result.data)throw new AttachmentError("This file could not be downloaded.");
 const bytes=new Uint8Array(await result.data.arrayBuffer());verifyAttachment(bytes,access.size_bytes,access.sha256);
 const current=await authorize();if(!current||current.sha256!==access.sha256)return null;
 return {...access,bytes};
}
/** Run from a trusted scheduled worker, never from a user-exposed unauth route. */
export async function cleanupAttachments(){
 const rows=z.array(z.object({id:z.string().uuid(),collaboration_id:z.string().uuid(),state:z.string()})).parse(await worker("cleanup"));
 let removed=0,failed=0;
 for(const row of rows){try{await purge(row.id,row.collaboration_id);removed++;}catch{failed++;try{await worker("cleanup_failed",row.id);}catch{/* The durable two-hour claim safely expires after a crash/outage. */}}}
 return {removed,failed};
}
