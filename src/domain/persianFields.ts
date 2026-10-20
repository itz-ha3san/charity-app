import {createRequire} from 'node:module';
import {z} from 'zod';
const require=createRequire(import.meta.url);
export const persianRules=require('./persianRules.cjs') as {digits:(v:string)=>string;normalizeIban:(v:string)=>string;normalizeName:(v:string)=>string;card:(v:string)=>boolean;iban:(v:string)=>boolean;postal:(v:string)=>boolean;national:(v:string)=>boolean};
export const iranDivisions=require('./iranDivisions.cjs') as Record<string,string[]>;
const addressPair=z.object({province:z.string().max(100).default(''),city:z.string().max(100).default('')}).superRefine((v,ctx)=>{
 if(!v.province&&!v.city)return;
 const province=Object.keys(iranDivisions).find(p=>persianRules.normalizeName(p)===persianRules.normalizeName(v.province));
 if(!province||!iranDivisions[province]?.some(c=>persianRules.normalizeName(c)===persianRules.normalizeName(v.city)))ctx.addIssue({code:'custom',path:['city'],message:'INVALID_PROVINCE_CITY'});
});
export function validateEnhancedFamily(next:Record<string,any>,before:Record<string,any>={}){
 const issues:z.ZodIssue[]=[];
 for(const [key,check,code] of [['headCardNumber',persianRules.card,'INVALID_CARD_NUMBER'],['headIban',persianRules.iban,'INVALID_IBAN'],['postalCode',persianRules.postal,'INVALID_POSTAL_CODE']] as const){
  if(next[key]&&next[key]!==before[key]&&!check(next[key]))issues.push({code:'custom',path:[key],message:code});
 }
 if((next.province??'')!==(before.province??'')||(next.city??'')!==(before.city??'')){
  const result=addressPair.safeParse(next);if(!result.success)issues.push(...result.error.issues);
  else if(next.province){const province=Object.keys(iranDivisions).find(p=>persianRules.normalizeName(p)===persianRules.normalizeName(next.province));if(province){next.province=province;next.city=iranDivisions[province]?.find(c=>persianRules.normalizeName(c)===persianRules.normalizeName(next.city));}}
 }
 if(issues.length)throw new z.ZodError(issues);
}
