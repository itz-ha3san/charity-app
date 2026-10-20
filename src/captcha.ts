import { randomBytes, randomInt, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
// A lightweight, adaptive first-party puzzle. Rate limits and account locks remain primary controls.
const WIDTH=320, HEIGHT=136, SIZE=40, Y=48, MAX_X=WIDTH-SIZE, TTL=120_000;
type Challenge={x:number;expires:number;verified:boolean;tries:number;ip:string};
export class CaptchaStore {
 private challenges=new Map<string,Challenge>();
 private rates=new Map<string,{n:number;until:number}>();
 constructor(private now=()=>Date.now(),private target=()=>randomInt(80,MAX_X-12)){}
 private key(token:string){return createHash('sha256').update(token).digest('hex');}
 private prune(){const now=this.now();for(const [k,v] of this.challenges)if(v.expires<=now)this.challenges.delete(k);for(const [k,v] of this.rates)if(v.until<=now)this.rates.delete(k);}
 issue(ip:string,oldToken?:string){
  this.prune();const rate=this.rates.get(ip);if(rate&&rate.n>=12)return null;
  if(this.challenges.size>=5000||(!rate&&this.rates.size>=5000))return null;
  this.rates.set(ip,{n:(rate?.n||0)+1,until:rate?.until||this.now()+60_000});
  if(oldToken)this.challenges.delete(this.key(oldToken));
  const token=randomBytes(32).toString('hex'),x=this.target();this.challenges.set(this.key(token),{x,expires:this.now()+TTL,verified:false,tries:0,ip});return {token,x};
 }
 verify(token:string|undefined,ip:string,x:number){
  if(!token)return false;const key=this.key(token),c=this.challenges.get(key);
  if(!c||c.ip!==ip||c.expires<=this.now()||c.verified||!Number.isFinite(x)){if(c&&c.expires<=this.now())this.challenges.delete(key);return false;}
  c.tries++;if(c.tries>5){this.challenges.delete(key);return false;}
  if(Math.abs(x-c.x)>3)return false;c.verified=true;c.expires=Math.min(c.expires,this.now()+60_000);return true;
 }
 consume(token:string|undefined,ip:string){if(!token)return false;const key=this.key(token),c=this.challenges.get(key);this.challenges.delete(key);return !!c&&c.ip===ip&&c.verified&&c.expires>this.now();}
 reset(){this.challenges.clear();this.rates.clear();}
}
export const captchaStore=new CaptchaStore();
let logo:PNG;
function getLogo(){return logo||=(PNG.sync.read(readFileSync(fileURLToPath(new URL('../public/brand/charity-logo.png',import.meta.url)))));}
function pixel(image:PNG,x:number,y:number,color:number[]){const i=(y*image.width+x)*4;for(let c=0;c<4;c++)image.data[i+c]=color[c]??255;}
function inside(x:number,y:number){return (x>=2&&x<34&&y>=8&&y<38)||(Math.hypot(x-18,y-8)<7)||(Math.hypot(x-34,y-24)<6);}
export function captchaImages(target:number){
 const bg=new PNG({width:WIDTH,height:HEIGHT}),piece=new PNG({width:SIZE,height:SIZE});
 const brand=getLogo();
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  const line=((x+2*y)%64)<3,noise=randomInt(0,7);pixel(bg,x,y,line?[180+noise,207+noise,232+noise,255]:[229+noise,239+noise,249+noise,255]);
  const sx=Math.floor((x-96)*brand.width/128),sy=Math.floor((y-8)*brand.height/116);
  if(sx>=0&&sx<brand.width&&sy>=0&&sy<brand.height){const i=(sy*brand.width+sx)*4,j=(y*WIDTH+x)*4,a=(brand.data[i+3]??0)/255;for(let c=0;c<3;c++)bg.data[j+c]=Math.round((brand.data[i+c]??0)*a+(bg.data[j+c]??255)*(1-a));}
 }
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(inside(x,y)){
  const j=((Y+y)*WIDTH+target+x)*4;colorCopy(piece,x,y,bg.data,j);pixel(bg,target+x,Y+y,[76,102,126,255]);
 }
 const data=(p:PNG)=>'data:image/png;base64,'+PNG.sync.write(p).toString('base64');return {background:data(bg),piece:data(piece),width:WIDTH,height:HEIGHT,size:SIZE,y:Y,max:MAX_X,expiresIn:TTL/1000};
}
function colorCopy(image:PNG,x:number,y:number,source:Buffer,index:number){pixel(image,x,y,[source[index]!,source[index+1]!,source[index+2]!,255]);}
