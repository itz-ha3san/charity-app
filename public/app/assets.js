/* Same-origin, code-owned asset map. One in-flight request per feature; failed loads can be retried. */
(() => {
  const definitions = Object.freeze({admin:'/app/admin.js',approval:'/approval-review.js'});
  const loading = new Map();
  function load(name) {
    if(!Object.hasOwn(definitions,name))return Promise.reject(new Error('UNKNOWN_FEATURE'));
    if(loading.has(name))return loading.get(name);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script'); script.src=definitions[name];
      script.onload=()=>resolve();
      script.onerror=()=>{loading.delete(name);script.remove();reject(new Error('بارگذاری بخش انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.'));};
      document.head.append(script);
    });
    loading.set(name,promise);return promise;
  }
  function register(name,names) {
    for(const entry of names) {
      const placeholder=async function(...args) {
        try {
          await load(name);
          const implementation=window[entry];
          if(implementation===placeholder || typeof implementation!=='function')throw new Error('راه‌اندازی بخش کامل نشد.');
          return await implementation.apply(this,args);
        } catch(error) { window.AppUI?.toast(error.message); return undefined; }
      };
      window[entry]=placeholder;
    }
  }
  window.AppAssets=Object.freeze({load,register});
})();
