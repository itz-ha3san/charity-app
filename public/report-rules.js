(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ReportRules=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const timeZone='Asia/Tehran';
  function parts(date,calendar){return Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,calendar,numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));}
  function today(date=new Date()){const p=parts(date,'gregory');return `${p.year}-${p.month}-${p.day}`;}
  function currentPeriod(date=new Date()){const p=parts(date,'persian');return {year:Number(p.year),month:Number(p.month)};}
  function rangeErrors(q,date=new Date()){
    const errors=[],limit=today(date);
    for(const key of ['from','to'])if(q[key]&&q[key]>limit)errors.push({path:key,message:'تاریخ گزارش نمی‌تواند بعد از امروز باشد.'});
    if(q.from&&q.to&&q.from>q.to)errors.push({path:'to',message:'از تاریخ نباید بعد از تا تاریخ باشد.'});
    return errors;
  }
  function periodErrors(q,date=new Date()){
    const errors=[],hasYear=q.jalaliYear!==undefined&&q.jalaliYear!=='',hasMonth=q.jalaliMonth!==undefined&&q.jalaliMonth!=='';
    if(hasYear!==hasMonth)return [{path:hasYear?'jalaliMonth':'jalaliYear',message:'سال و ماه را با هم انتخاب کنید.'}];
    if(hasYear){const y=Number(q.jalaliYear),m=Number(q.jalaliMonth),p=currentPeriod(date);
      if(!Number.isInteger(y)||y<1300)errors.push({path:'jalaliYear',message:'سال شمسی معتبر وارد کنید.'});
      if(!Number.isInteger(m)||m<1||m>12)errors.push({path:'jalaliMonth',message:'ماه باید بین ۱ و ۱۲ باشد.'});
      if(y>p.year||(y===p.year&&m>p.month))errors.push({path:'jalaliMonth',message:'دوره مالی آینده قابل انتخاب نیست.'});
    }
    return errors;
  }
  return {today,currentPeriod,rangeErrors,periodErrors};
});
