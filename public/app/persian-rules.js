/* Shared browser/server rules. Format validation is not identity, ownership or address verification. */
(function(root){
const en=v=>String(v??'').replace(/[۰-۹٠-٩]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.includes(d)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(d):'٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const digits=v=>en(v).replace(/[\s\-\u200e\u200f]/g,'');
const national=v=>{const s=digits(v);if(!/^\d{10}$/.test(s)||/^(\d)\1{9}$/.test(s))return false;const r=[...s.slice(0,9)].reduce((a,d,i)=>a+Number(d)*(10-i),0)%11;return Number(s[9])===(r<2?r:11-r);};
const card=v=>{const s=digits(v);if(!/^\d{16}$/.test(s)||/^(\d)\1{15}$/.test(s))return false;return [...s].reduce((a,d,i)=>{let n=Number(d)*(i%2?1:2);return a+(n>9?n-9:n);},0)%10===0;};
const normalizeIban=v=>{const s=digits(v).toUpperCase();return s&&!s.startsWith('IR')?'IR'+s:s;};
const iban=v=>{const s=normalizeIban(v);if(!/^IR\d{24}$/.test(s))return false;let n=0;for(const d of s.slice(4)+'1827'+s.slice(2,4))n=(n*10+Number(d))%97;return n===1;};
const postal=v=>/^\d{10}$/.test(digits(v))&&!/^(\d)\1{9}$/.test(digits(v));
const time=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(en(v));
const fa=v=>en(v).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const normalizeName=v=>String(v??'').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]+/g,' ').trim();
const banks={'603799':'ملی','610433':'ملت','621986':'سامان','502229':'پاسارگاد','627648':'توسعه صادرات','627961':'صنعت و معدن','603770':'کشاورزی','628023':'مسکن','589210':'سپه','589463':'رفاه','627353':'تجارت','603769':'صادرات','622106':'پارسیان','627412':'اقتصاد نوین','627488':'کارآفرین','639346':'سینا','504706':'شهر','606373':'قرض‌الحسنه مهر ایران','504172':'رسالت','636214':'آینده'};
const ibanBanks={'017':'ملی','012':'ملت','056':'سامان','057':'پاسارگاد','015':'سپه','016':'کشاورزی','014':'مسکن','013':'رفاه','018':'تجارت','019':'صادرات','054':'پارسیان','055':'اقتصاد نوین','053':'کارآفرین','059':'سینا','061':'شهر','060':'قرض‌الحسنه مهر ایران','070':'رسالت','062':'آینده','021':'پست بانک'};
const group=(s,kind)=>kind==='national'?([s.slice(0,3),s.slice(3,9),s.slice(9)].filter(Boolean).join('-')):kind==='postal'?([s.slice(0,5),s.slice(5)].filter(Boolean).join('-')):(s.match(/.{1,4}/g)||[]).join(' ');
const rules={en,digits,fa,national,card,iban,postal,time,normalizeIban,normalizeName,group,cardBank:v=>banks[digits(v).slice(0,6)]||null,ibanBank:v=>ibanBanks[normalizeIban(v).slice(4,7)]||null};
if(typeof module!=='undefined'&&module.exports)module.exports=rules;else root.PersianRules=Object.freeze(rules);
})(globalThis);
