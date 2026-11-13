import "server-only";
import {z}from "zod";
import {notFound,redirect}from "next/navigation";
import {marketplaceContext}from "./marketplace";
import {AppError}from "@/server/errors";
import {collaborationDetail,collaborationRecord}from "@/lib/collaboration";
import type{Json}from "@/lib/database.types";
import{uuid}from "@/lib/marketplace";
export async function collaborationQuery(kind:string,id?:string,filters:Record<string,string|number>={}){
 const context=await marketplaceContext();
 if(kind.startsWith("admin_")&&context.member.role!=="admin")redirect("/dashboard");
 if(id&&!uuid.safeParse(id).success)notFound();
 const {data,error}=await context.client.rpc("collaboration_read",{p_kind:kind,...(id?{p_id:id}:{}),p_filters:filters}).abortSignal(AbortSignal.timeout(15_000));
 if(error)throw new AppError("UNAVAILABLE","We couldn’t load this workspace. Refresh and try again.");
 return {...context,data};
}
export async function getCollaboration(id:string){const result=await collaborationQuery("detail",id);if(!result.data)notFound();return {...result,data:collaborationDetail.parse(result.data)};}
export async function collaborationList(offset=0){const result=await collaborationQuery("list",undefined,{offset});return{...result,data:z.object({items:z.array(collaborationRecord.omit({opportunity_id:true,brand_id:true,influencer_id:true,latest_submission:true}).extend({brand_name:z.string().nullable(),influencer_name:z.string().nullable()})),total:z.number()}).parse(result.data)};}
export async function collaborationPage<T>(kind:string,id:string,offset:number,schema:z.ZodType<T>){const result=await collaborationQuery(kind,id,{offset});return z.object({items:z.array(schema),total:z.number()}).parse(result.data);}
export async function collaborationMutation(kind:"collaboration"|"support",action:string,id:string|undefined,data:Json){
 const {client}=await marketplaceContext();
 return kind==="collaboration"?client.rpc("collaboration_command",{p_action:action,p_id:id!,p_data:data}).abortSignal(AbortSignal.timeout(15_000)):client.rpc("support_command",{p_action:action,...(id?{p_id:id}:{}),p_data:data}).abortSignal(AbortSignal.timeout(15_000));
}
