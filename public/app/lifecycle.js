/* Shared body-render subscription for legacy enhancers. Narrow component observers stay local. */
(() => {
  const subscribers=new Map();let observer;
  function subscribe(name,callback) {
    subscribers.set(name,callback);
    if(!observer){
      observer=new MutationObserver(records=>{
        for(const callback of subscribers.values()) {
          try { callback(records); } catch(error) { console.error('UI enhancement failed',error); }
        }
      });
      observer.observe(document.body,{childList:true,subtree:true});
    }
    return ()=>{subscribers.delete(name);if(!subscribers.size){observer.disconnect();observer=null;}};
  }
  window.AppLifecycle=Object.freeze({subscribe});
})();
