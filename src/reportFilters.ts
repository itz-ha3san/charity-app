import {z} from "zod";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
export const reportRules=require("./reportRules.cjs") as {
  rangeErrors(q:{from?:string;to?:string}):{path:string;message:string}[];
  periodErrors(q:{jalaliYear?:number;jalaliMonth?:number}):{path:string;message:string}[];
};
export const reportRangeShape={from:z.string().date().optional(),to:z.string().date().optional()};
export function validateReportRange(q:{from?:string;to?:string},ctx:z.RefinementCtx){
  for(const issue of reportRules.rangeErrors(q))ctx.addIssue({code:z.ZodIssueCode.custom,path:[issue.path],message:issue.message});
}
export function validateReportPeriod(q:{jalaliYear?:number;jalaliMonth?:number},ctx:z.RefinementCtx){
  for(const issue of reportRules.periodErrors(q))ctx.addIssue({code:z.ZodIssueCode.custom,path:[issue.path],message:issue.message});
}
