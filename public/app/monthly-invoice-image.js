/* Branded, narrow transfer-style receipt. Canvas stays local; no upload or financial write. */
(() => {
 const number=v=>BigInt(v??0).toLocaleString('fa-IR');
 const cash=v=>number(v)+' تومان';
 const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
 async function create({groups,liaisonName,year,month,status,logoUrl,isActive=()=>true}){
  if(!groups.length)throw new Error('EMPTY_INVOICE');
  await document.fonts.load('500 24px Vazirmatn','صورت‌حساب ماهیانه');
  if(!document.fonts.check('500 24px Vazirmatn','صورت‌حساب ماهیانه'))throw new Error('FONT_UNAVAILABLE');
  const url=new URL(logoUrl,location.origin);
  if(url.origin!==location.origin)throw new Error('INVALID_LOGO');
  const logo=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('LOGO_UNAVAILABLE'));image.src=url.href;});
  const W=660,H=2600,M=58,RIGHT=W-M,INNER=W-2*M,BOTTOM=H-100,pages=[];
  const C={bg:'#0c1623',ink:'#e7effb',muted:'#99aec7',blue:'#b9d9ff',line:'#3a526e',green:'#9cd2c4'};
  const families=groups.flatMap(g=>g.families),base=families.reduce((s,f)=>s+BigInt(f.baseAmount??0),0n),total=groups.reduce((s,g)=>s+BigInt(g.totalAmount),0n);
  const period=months[month-1]+' '+Number(year).toLocaleString('fa-IR',{useGrouping:false});
  let canvas,ctx,y,notches=[];
  const check=()=>{if(!isActive())throw new Error('EXPORT_CANCELLED');};
  function font(size=20,weight=500){ctx.font=`${weight} ${size}px Vazirmatn`;ctx.direction='rtl';ctx.textBaseline='top';}
  function text(value,x,top,{size=20,weight=500,color=C.ink,align='right'}={}){font(size,weight);ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(String(value),x,top);}
  function wrap(value,width,size=20,weight=500){font(size,weight);const lines=[];let current='';for(const word of String(value).split(/\s+/)){if(ctx.measureText(word).width>width){if(current){lines.push(current);current='';}for(const char of Array.from(word)){if(ctx.measureText(current+char).width>width){lines.push(current);current='';}current+=char;}}else if(ctx.measureText(current?current+' '+word:word).width>width){lines.push(current);current=word;}else current+=(current?' ':'')+word;}if(current)lines.push(current);return lines.length?lines:[''];}
  function rounded(x,top,width,height,radius,fill,stroke){ctx.beginPath();ctx.roundRect(x,top,width,height,radius);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function start(){check();notches=[];canvas=document.createElement('canvas');canvas.width=W*2;canvas.height=H*2;ctx=canvas.getContext('2d');if(!ctx)throw new Error('CANVAS_UNAVAILABLE');ctx.scale(2,2);
   const gradient=ctx.createLinearGradient(0,0,W,H);gradient.addColorStop(0,'#20364f');gradient.addColorStop(.55,'#182a3d');gradient.addColorStop(1,'#142334');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
   const ratio=logo.naturalWidth/logo.naturalHeight;ctx.drawImage(logo,M,47,48,48/ratio);
   text('صورت‌حساب ماهیانه',RIGHT,55,{size:15,color:C.muted});
   rounded(W/2-35,116,70,70,21,'#2b5279','#466d96');
   // Receipt icon, in the same blue tile as the on-screen sidebar.
   ctx.strokeStyle='#b1d5ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(W/2-11,132);ctx.lineTo(W/2+7,132);ctx.lineTo(W/2+14,139);ctx.lineTo(W/2+14,171);ctx.lineTo(W/2-11,171);ctx.closePath();ctx.stroke();
   ctx.beginPath();ctx.moveTo(W/2+6,132);ctx.lineTo(W/2+6,140);ctx.lineTo(W/2+14,140);for(const row of [148,155,162]){ctx.moveTo(W/2-5,row);ctx.lineTo(W/2+7,row);}ctx.stroke();
   text('جمع کل ماهیانهٔ رابط',W/2,210,{size:27,weight:700,align:'center'});
   y=257;for(const line of wrap(liaisonName+' · '+period,INNER,18)){text(line,W/2,y,{size:18,color:C.muted,align:'center'});y+=29;}
   const label=status==='submitted'?'درخواست ثبت‌شده':'پیش‌نویس · ثبت نهایی نشده';font(15,500);const width=ctx.measureText(label).width+30;rounded((W-width)/2,y+4,width,35,12,status==='submitted'?'#244d46':'#3b3b39',status==='submitted'?'#48766b':'#70644f');text(label,W/2,y+12,{size:15,color:status==='submitted'?C.green:'#e6c391',align:'center'});y+=63;
   if(pages.length){text('ادامهٔ صورت‌حساب · صفحهٔ '+number(pages.length+1),W/2,y,{size:16,color:C.muted,align:'center'});y+=40;}
  }
  async function finish(){check();if(pages.length>=100)throw new Error('INVOICE_TOO_LONG');
   const height=Math.min(H,Math.max(560,y+104));
   text('این تصویر رسید بانکی یا تأیید انتقال وجه نیست.',W/2,height-76,{size:15,color:C.muted,align:'center'});
   text('صفحهٔ '+number(pages.length+1),W/2,height-46,{size:13,color:'#7c93ad',align:'center'});
   const output=document.createElement('canvas');output.width=W*2;output.height=height*2;const out=output.getContext('2d');out.scale(2,2);out.fillStyle=C.bg;out.fillRect(0,0,W,height);out.save();out.beginPath();out.roundRect(20,20,W-40,height-40,30);out.clip();out.drawImage(canvas,0,0,W*2,height*2,0,0,W,height);out.restore();out.lineWidth=1.5;out.strokeStyle='#476786';out.beginPath();out.roundRect(20,20,W-40,height-40,30);out.stroke();
   for(const top of notches)for(const x of [20,W-20]){out.fillStyle=C.bg;out.strokeStyle='#476786';out.beginPath();out.arc(x,top,10,0,Math.PI*2);out.fill();out.stroke();}
   const blob=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(new Error('PNG_FAILED')),'image/png'));pages.push(blob);canvas.width=canvas.height=0;output.width=output.height=0;
  }
  async function room(height){check();if(y+height>BOTTOM){await finish();start();}}
  async function paragraph(value,{size=19,weight=500,color=C.muted,center=false}={}){for(const line of wrap(value,INNER,size,weight)){await room(size+20);text(line,center?W/2:RIGHT,y,{size,weight,color,align:center?'center':'right'});y+=size+14;}y+=5;}
  async function pair(label,value,{size=18,strong=false,note=''}={}){const right=wrap(label,INNER-260,size,strong?700:500),left=wrap(value,235,size+1,strong?700:500),height=Math.max(right.length,left.length)*30;await room(height+(note?32:0)+24);right.forEach((line,i)=>text(line,RIGHT,y+i*30,{size,weight:strong?700:500,color:C.muted}));left.forEach((line,i)=>text(line,M,y+i*30,{size:size+1,weight:strong?700:500,align:'left',color:strong?C.blue:C.ink}));y+=height;if(note){text(note,RIGHT,y,{size:14,color:'#839db8'});y+=28;}y+=20;}
  async function rule(dashed=false){await room(35);ctx.strokeStyle=C.line;ctx.lineWidth=1;ctx.setLineDash(dashed?[4,4]:[]);ctx.beginPath();ctx.moveTo(dashed?20:M,y);ctx.lineTo(dashed?W-20:RIGHT,y);ctx.stroke();ctx.setLineDash([]);if(dashed)notches.push(y);y+=28;}
  async function aidCard(family,aid){const heading=wrap('خانوادهٔ '+family.familyName,INNER-36,20,700),supervisor=wrap('سرپرست: '+family.supervisorName,INNER-36,15),topic=wrap('موضوع: '+aid.category+' · '+aid.title,INNER-36,17);
   // Split exceptionally long descriptions, never clip or shrink the actual subject.
   const lines=[...heading.map(t=>({t,size:20,weight:700})),...supervisor.map(t=>({t,size:15,color:C.muted})),...topic.map(t=>({t,size:17,color:C.green}))];
   while(lines.length){const capacity=Math.max(1,Math.floor((BOTTOM-420)/32)),chunk=lines.splice(0,capacity),height=chunk.reduce((s,l)=>s+l.size+13,0)+90;await room(height+16);rounded(M,y,INNER,height,17,'#1b3b48','#467d84');let top=y+20;for(const line of chunk){text(line.t,RIGHT-18,top,line);top+=line.size+13;}text(lines.length?'ادامهٔ جزئیات در صفحهٔ بعد…':cash(aid.amount),M+18,top+12,{size:21,weight:700,color:C.green,align:'left'});y+=height+16;}
  }
  try{start();await pair('خانواده‌های تحت پوشش',number(families.length)+' خانواده');await pair('تعداد سرپرست‌ها',number(groups.length)+' سرپرست');await rule();
   await paragraph('مجموع واریزی هر سرپرست',{size:18});await paragraph('واریزی هر خانواده جداگانه به سرپرست انجام می‌شود.',{size:15});
   for(const group of groups){await pair(group.supervisorName,cash(group.totalAmount),{strong:true,note:number(group.families.length)+' خانواده'});
    // Each transfer is per family: total beside its name, then fixed/extra breakdown and its own aid cards.
    for(const family of group.families){
     await room(250);
     await pair('خانوادهٔ '+family.familyName,cash(family.totalAmount),{size:20,strong:true,note:'مجموع واریزی این خانواده'});
     await pair('ماهیانهٔ خانواده',family.baseAmount===null?'تعیین نشده':cash(family.baseAmount),{size:16});
     const extra=family.extras.reduce((s,a)=>s+BigInt(a.amount),0n);
     await pair('موردیِ خانواده',cash(extra),{size:16});
     for(const aid of family.extras)await aidCard(family,aid);
     if(family.baseAmount===null)await paragraph('مبلغ ماهیانه نامشخص است؛ جمع این خانواده نهایی نیست.',{size:14,color:'#efb193'});
     if(family.conflict&&status!=='submitted')await paragraph('این دوره قبلاً برای خانواده ثبت شده است.',{size:14,color:'#efb193'});
     await rule();
    }
    await rule();
   }
   await pair('جمع مبالغ ثابت ماهیانه',cash(base),{strong:true});
   const extras=families.flatMap(f=>f.extras.map(a=>({family:f,aid:a})));
   await rule(true);await paragraph('جزئیات کمک‌های موردی',{size:18});
   if(!extras.length)await paragraph('کمک موردی به این صورت‌حساب اضافه نشده است.',{size:16});
   for(const item of extras)await aidCard(item.family,item.aid);
   if(extras.length)await pair('جمع کمک‌های موردی',cash(total-base),{strong:true});
   await room(285);await rule(true);await paragraph('مجموع واریزی همهٔ خانواده‌ها',{size:19,center:true});
   let size=46;font(size,700);while(ctx.measureText(number(total)).width>INNER&&size>22){size-=2;font(size,700);}text(number(total),W/2,y+10,{size,weight:700,color:C.blue,align:'center'});y+=size+35;text('تومان',W/2,y,{size:18,color:C.muted,align:'center'});y+=51;
   await paragraph('✓ '+number(families.length)+' خانواده · '+number(groups.length)+' صورت‌حساب تفکیک‌شده',{size:15,color:C.green,center:true});
   if(families.some(f=>f.baseAmount===null))await paragraph('مبلغ بعضی خانواده‌ها مشخص نیست؛ جمع پیش‌نویس نهایی نیست.',{size:16,color:'#efb193',center:true});
   await finish();return pages;
  }finally{if(canvas)canvas.width=canvas.height=0;}
 }
 window.MonthlyInvoiceImage=Object.freeze({create});
})();
