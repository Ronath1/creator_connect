import {unstable_rethrow} from "next/navigation";
import {z} from "zod";
import {attachmentRequestContext,fileHeaders} from "@/server/attachments/request-context";
import {downloadAttachment} from "@/server/attachments/worker-client";
import {boundedBody,sameOrigin} from "@/server/attachments/body";
export const runtime="nodejs",dynamic="force-dynamic";
async function deliver(id:string,report?:string,reason?:string){
 const context=await attachmentRequestContext();if(context.status!==200)return new Response("File access unavailable.",{status:context.status,headers:fileHeaders});
 if(!z.string().uuid().safeParse(id).success)return new Response("File unavailable.",{status:404,headers:fileHeaders});
 const file=await downloadAttachment(context.client,id,report,reason);if(!file)return new Response("File unavailable.",{status:404,headers:fileHeaders});
 return new Response(new Uint8Array(file.bytes),{headers:{...fileHeaders,"Content-Type":file.content_type,"Content-Disposition":`attachment; filename="attachment.${file.content_type==="application/pdf"?"pdf":"webp"}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`}});
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{return await deliver((await params).id);}catch(error){unstable_rethrow(error);return new Response("File unavailable.",{status:403,headers:fileHeaders});}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  if(!sameOrigin(request))return new Response("File access unavailable.",{status:403,headers:fileHeaders});
  const body=await boundedBody(request,8192),form=await new Response(body,{headers:{"Content-Type":request.headers.get("content-type")??""}}).formData();
  const fields=z.object({report:z.string().uuid(),reason:z.string().trim().min(3).max(1000)}).parse({report:form.get("report"),reason:form.get("reason")});
  return await deliver((await params).id,fields.report,fields.reason);
 }catch(error){unstable_rethrow(error);return new Response("File unavailable.",{status:403,headers:fileHeaders});}
}
