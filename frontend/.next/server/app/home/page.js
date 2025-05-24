(()=>{var e={};e.id=8620,e.ids=[8620],e.modules={3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},12412:e=>{"use strict";e.exports=require("assert")},19121:e=>{"use strict";e.exports=require("next/dist/server/app-render/action-async-storage.external.js")},21820:e=>{"use strict";e.exports=require("os")},27910:e=>{"use strict";e.exports=require("stream")},28354:e=>{"use strict";e.exports=require("util")},29021:e=>{"use strict";e.exports=require("fs")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:e=>{"use strict";e.exports=require("path")},39718:(e,t,r)=>{Promise.resolve().then(r.bind(r,77862))},47966:(e,t,r)=>{Promise.resolve().then(r.bind(r,67840))},52735:(e,t,r)=>{"use strict";r.d(t,{A:()=>i});var s=r(60687),n=r(43210);let i=({message:e="Loading...",fullScreen:t=!0,type:r="spinner",size:i="md",color:o="indigo"})=>{let[a,l]=(0,n.useState)(["green"]);(0,n.useEffect)(()=>{if("random-ripple"===r){let e=["green","purple","pink","yellow"],t=e[Math.floor(Math.random()*e.length)];console.log("Selected ripple color (fixed):",t),l([t])}},[r]);let c=e=>{switch(e){case"green":default:return"border-green-700";case"purple":return"border-purple-700";case"pink":return"border-pink-700";case"yellow":return"border-orange-600"}},d=(()=>{switch(i){case"sm":return{container:"h-6 w-6",text:"text-sm"};case"md":default:return{container:"h-10 w-10",text:"text-base"};case"lg":return{container:"h-16 w-16",text:"text-xl"}}})(),u=(()=>{switch(o){case"indigo":default:return"text-indigo-600";case"blue":return"text-blue-600";case"green":return"text-green-600";case"purple":return"text-purple-600";case"pink":return"text-pink-600";case"yellow":return"text-yellow-600"}})(),p={spinner:(0,s.jsxs)("svg",{className:`animate-spin ${d.container} ${u}`,xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",children:[(0,s.jsx)("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),(0,s.jsx)("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"})]}),dots:(0,s.jsx)("div",{className:"flex space-x-1",children:[0,1,2].map(e=>(0,s.jsx)("div",{className:`${"sm"===i?"w-2 h-2":"lg"===i?"w-4 h-4":"w-3 h-3"} bg-current rounded-full animate-pulse ${u}`,style:{animationDelay:`${.3*e}s`,animationDuration:"1.4s"}},e))}),pulse:(0,s.jsxs)("div",{className:`${d.container} ${u} relative`,children:[(0,s.jsx)("div",{className:"absolute inset-0 bg-current rounded-full animate-ping opacity-75"}),(0,s.jsx)("div",{className:"absolute inset-2 bg-current rounded-full animate-pulse"})]}),bounce:(0,s.jsx)("div",{className:"flex space-x-1",children:[0,1,2].map(e=>(0,s.jsx)("div",{className:`${"sm"===i?"w-2 h-2":"lg"===i?"w-4 h-4":"w-3 h-3"} bg-current rounded-full animate-bounce ${u}`,style:{animationDelay:`${.1*e}s`}},e))}),ripple:(0,s.jsxs)("div",{className:`${d.container} relative`,children:[(0,s.jsx)("div",{className:`absolute inset-0 border-4 border-current rounded-full animate-ping ${u} opacity-75`}),(0,s.jsx)("div",{className:`absolute inset-1 border-4 border-current rounded-full animate-ping ${u} opacity-50`,style:{animationDelay:"0.5s"}})]}),wave:(0,s.jsx)("div",{className:"flex items-end space-x-1",children:[0,1,2,3,4].map(e=>(0,s.jsx)("div",{className:`${"sm"===i?"w-1":"lg"===i?"w-2":"w-1.5"} bg-current ${u} animate-pulse`,style:{height:`${"sm"===i?16:"lg"===i?32:24}px`,animationDelay:`${.1*e}s`,animationDuration:"1s"}},e))}),"random-ripple":(0,s.jsxs)("div",{className:"w-20 h-20 relative overflow-hidden",children:[(()=>{let e=a.length>0?a[0]:"green";return(0,s.jsxs)(s.Fragment,{children:[[0,1,2].map(t=>(0,s.jsx)("div",{className:`absolute top-1/2 left-1/2 rounded-full ${c(e).replace("border-","bg-")}`,style:{width:"30%",height:"30%",marginTop:"-15%",marginLeft:"-15%",animation:`rippleEffect 2s infinite ${.5*t}s cubic-bezier(0, 0, 0.2, 1)`,transform:"scale(0)",opacity:1}},`ripple-${t}-${e}`)),(0,s.jsx)("div",{className:`absolute top-1/2 left-1/2 ${c(e).replace("border-","bg-")} rounded-full`,style:{width:"20%",height:"20%",marginTop:"-10%",marginLeft:"-10%",opacity:.9}})]})})(),(0,s.jsx)("style",{dangerouslySetInnerHTML:{__html:`
            @keyframes rippleEffect {
              0% {
                transform: scale(0);
                opacity: 0.8;
              }
              100% {
                transform: scale(6);
                opacity: 0;
              }
            }
          `}})]})};return t?(0,s.jsxs)("div",{className:"min-h-screen bg-gray-50 flex flex-col items-center justify-center fixed inset-0 z-[9999]",children:[(0,s.jsx)("div",{className:"mb-4",children:p[r]}),(0,s.jsx)("p",{className:`mt-2 ${d.text} font-medium text-gray-700`,children:e})]}):(0,s.jsxs)("div",{className:"flex items-center justify-center py-2",children:[(0,s.jsx)("div",{className:"mr-2",children:p[r]}),(0,s.jsx)("span",{className:"text-sm font-medium text-gray-700",children:e})]})}},55511:e=>{"use strict";e.exports=require("crypto")},55591:e=>{"use strict";e.exports=require("https")},55611:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>s});let s=(0,r(12907).registerClientReference)(function(){throw Error("Attempted to call the default export of \"/Users/genie/SmapSource/smap_next/frontend/src/app/home/layout.tsx\" from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"/Users/genie/SmapSource/smap_next/frontend/src/app/home/layout.tsx","default")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},64962:(e,t,r)=>{"use strict";r.d(t,{A:()=>i});var s=r(45129);class n{async getAllGroups(e=0,t=100){try{return(await s.A.get(`/groups?skip=${e}&limit=${t}`)).data}catch(e){throw console.error("Failed to fetch all groups:",e),e}}async getGroupById(e){try{return(await s.A.get(`/groups/${e}`)).data}catch(t){throw console.error(`Failed to fetch group ${e}:`,t),t}}async getMemberGroups(e){try{return(await s.A.get(`/v1/groups/member/${e}`)).data}catch(e){throw console.error("Failed to fetch member groups:",e),e}}async getGroupByCode(e){try{return(await s.A.get(`/groups/code/${e}`)).data}catch(t){throw console.error(`Failed to fetch group with code ${e}:`,t),t}}async createGroup(e){try{return(await s.A.post("/groups",e)).data}catch(e){throw console.error("Failed to create group:",e),e}}async updateGroup(e,t){try{return(await s.A.put(`/groups/${e}`,t)).data}catch(t){throw console.error(`Failed to update group ${e}:`,t),t}}async deleteGroup(e){try{return(await s.A.delete(`/groups/${e}`)).data}catch(t){throw console.error(`Failed to delete group ${e}:`,t),t}}async getCurrentUserGroups(){try{return await this.getMemberGroups(1186)}catch(e){throw console.error("Failed to fetch current user groups:",e),e}}}let i=new n},67840:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>i,dynamic:()=>n});var s=r(12907);let n=(0,s.registerClientReference)(function(){throw Error("Attempted to call dynamic() from the server but dynamic is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"/Users/genie/SmapSource/smap_next/frontend/src/app/home/page.tsx","dynamic"),i=(0,s.registerClientReference)(function(){throw Error("Attempted to call the default export of \"/Users/genie/SmapSource/smap_next/frontend/src/app/home/page.tsx\" from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"/Users/genie/SmapSource/smap_next/frontend/src/app/home/page.tsx","default")},67905:(e,t,r)=>{Promise.resolve().then(r.bind(r,55611))},68572:(e,t,r)=>{"use strict";r.r(t),r.d(t,{GlobalError:()=>o.a,__next_app__:()=>u,pages:()=>d,routeModule:()=>p,tree:()=>c});var s=r(65239),n=r(48088),i=r(88170),o=r.n(i),a=r(30893),l={};for(let e in a)0>["default","tree","pages","GlobalError","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>a[e]);r.d(t,l);let c={children:["",{children:["home",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(r.bind(r,67840)),"/Users/genie/SmapSource/smap_next/frontend/src/app/home/page.tsx"]}]},{layout:[()=>Promise.resolve().then(r.bind(r,55611)),"/Users/genie/SmapSource/smap_next/frontend/src/app/home/layout.tsx"]}]},{layout:[()=>Promise.resolve().then(r.bind(r,78623)),"/Users/genie/SmapSource/smap_next/frontend/src/app/layout.tsx"],"not-found":[()=>Promise.resolve().then(r.t.bind(r,57398,23)),"next/dist/client/components/not-found-error"],forbidden:[()=>Promise.resolve().then(r.t.bind(r,89999,23)),"next/dist/client/components/forbidden-error"],unauthorized:[()=>Promise.resolve().then(r.t.bind(r,65284,23)),"next/dist/client/components/unauthorized-error"]}]}.children,d=["/Users/genie/SmapSource/smap_next/frontend/src/app/home/page.tsx"],u={require:r,loadChunk:()=>Promise.resolve()},p=new s.AppPageRouteModule({definition:{kind:n.RouteKind.APP_PAGE,page:"/home/page",pathname:"/home",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:c}})},74075:e=>{"use strict";e.exports=require("zlib")},77862:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>A,dynamic:()=>k});var s,n=r(60687),i=r(76180),o=r.n(i),a=r(43210),l=r(85814),c=r.n(l),d=r(16189),u=r(75699);r(90327);var p=r(89506),m=r(52639);"function"==typeof SuppressedError&&SuppressedError;var h=function(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}(function e(t,r){if(t===r)return!0;if(t&&r&&"object"==typeof t&&"object"==typeof r){if(t.constructor!==r.constructor)return!1;if(Array.isArray(t)){if((s=t.length)!=r.length)return!1;for(n=s;0!=n--;)if(!e(t[n],r[n]))return!1;return!0}if(t.constructor===RegExp)return t.source===r.source&&t.flags===r.flags;if(t.valueOf!==Object.prototype.valueOf)return t.valueOf()===r.valueOf();if(t.toString!==Object.prototype.toString)return t.toString()===r.toString();if((s=(i=Object.keys(t)).length)!==Object.keys(r).length)return!1;for(n=s;0!=n--;)if(!Object.prototype.hasOwnProperty.call(r,i[n]))return!1;for(n=s;0!=n--;){var s,n,i,o=i[n];if(!e(t[o],r[o]))return!1}return!0}return t!=t&&r!=r});let g="__googleMapsScriptId";!function(e){e[e.INITIALIZED=0]="INITIALIZED",e[e.LOADING=1]="LOADING",e[e.SUCCESS=2]="SUCCESS",e[e.FAILURE=3]="FAILURE"}(s||(s={}));class x{constructor({apiKey:e,authReferrerPolicy:t,channel:r,client:s,id:n=g,language:i,libraries:o=[],mapIds:a,nonce:l,region:c,retries:d=3,url:u="https://maps.googleapis.com/maps/api/js",version:p}){if(this.callbacks=[],this.done=!1,this.loading=!1,this.errors=[],this.apiKey=e,this.authReferrerPolicy=t,this.channel=r,this.client=s,this.id=n||g,this.language=i,this.libraries=o,this.mapIds=a,this.nonce=l,this.region=c,this.retries=d,this.url=u,this.version=p,x.instance){if(!h(this.options,x.instance.options))throw Error(`Loader must not be called again with different options. ${JSON.stringify(this.options)} !== ${JSON.stringify(x.instance.options)}`);return x.instance}x.instance=this}get options(){return{version:this.version,apiKey:this.apiKey,channel:this.channel,client:this.client,id:this.id,libraries:this.libraries,language:this.language,region:this.region,mapIds:this.mapIds,nonce:this.nonce,url:this.url,authReferrerPolicy:this.authReferrerPolicy}}get status(){return this.errors.length?s.FAILURE:this.done?s.SUCCESS:this.loading?s.LOADING:s.INITIALIZED}get failed(){return this.done&&!this.loading&&this.errors.length>=this.retries+1}createUrl(){let e=this.url;return e+="?callback=__googleMapsCallback&loading=async",this.apiKey&&(e+=`&key=${this.apiKey}`),this.channel&&(e+=`&channel=${this.channel}`),this.client&&(e+=`&client=${this.client}`),this.libraries.length>0&&(e+=`&libraries=${this.libraries.join(",")}`),this.language&&(e+=`&language=${this.language}`),this.region&&(e+=`&region=${this.region}`),this.version&&(e+=`&v=${this.version}`),this.mapIds&&(e+=`&map_ids=${this.mapIds.join(",")}`),this.authReferrerPolicy&&(e+=`&auth_referrer_policy=${this.authReferrerPolicy}`),e}deleteScript(){let e=document.getElementById(this.id);e&&e.remove()}load(){return this.loadPromise()}loadPromise(){return new Promise((e,t)=>{this.loadCallback(r=>{r?t(r.error):e(window.google)})})}importLibrary(e){return this.execute(),google.maps.importLibrary(e)}loadCallback(e){this.callbacks.push(e),this.execute()}setScript(){var e,t;if(document.getElementById(this.id))return void this.callback();let r={key:this.apiKey,channel:this.channel,client:this.client,libraries:this.libraries.length&&this.libraries,v:this.version,mapIds:this.mapIds,language:this.language,region:this.region,authReferrerPolicy:this.authReferrerPolicy};Object.keys(r).forEach(e=>!r[e]&&delete r[e]),(null==(t=null==(e=null==window?void 0:window.google)?void 0:e.maps)?void 0:t.importLibrary)||(e=>{let t,r,s,n="The Google Maps JavaScript API",i="google",o="importLibrary",a="__ib__",l=document,c=window,d=(c=c[i]||(c[i]={})).maps||(c.maps={}),u=new Set,p=new URLSearchParams,m=()=>t||(t=new Promise((o,c)=>{var m,h,g,x;return m=this,h=void 0,g=void 0,x=function*(){var m;for(s in yield r=l.createElement("script"),r.id=this.id,p.set("libraries",[...u]+""),e)p.set(s.replace(/[A-Z]/g,e=>"_"+e[0].toLowerCase()),e[s]);p.set("callback",i+".maps."+a),r.src=this.url+"?"+p,d[a]=o,r.onerror=()=>t=c(Error(n+" could not load.")),r.nonce=this.nonce||(null==(m=l.querySelector("script[nonce]"))?void 0:m.nonce)||"",l.head.append(r)},new(g||(g=Promise))(function(e,t){function r(e){try{n(x.next(e))}catch(e){t(e)}}function s(e){try{n(x.throw(e))}catch(e){t(e)}}function n(t){var n;t.done?e(t.value):((n=t.value)instanceof g?n:new g(function(e){e(n)})).then(r,s)}n((x=x.apply(m,h||[])).next())})}));d[o]?console.warn(n+" only loads once. Ignoring:",e):d[o]=(e,...t)=>u.add(e)&&m().then(()=>d[o](e,...t))})(r);let s=this.libraries.map(e=>this.importLibrary(e));s.length||s.push(this.importLibrary("core")),Promise.all(s).then(()=>this.callback(),e=>{let t=new ErrorEvent("error",{error:e});this.loadErrorCallback(t)})}reset(){this.deleteScript(),this.done=!1,this.loading=!1,this.errors=[],this.onerrorEvent=null}resetIfRetryingFailed(){this.failed&&this.reset()}loadErrorCallback(e){if(this.errors.push(e),this.errors.length<=this.retries){let e=this.errors.length*Math.pow(2,this.errors.length);console.error(`Failed to load Google Maps script, retrying in ${e} ms.`),setTimeout(()=>{this.deleteScript(),this.setScript()},e)}else this.onerrorEvent=e,this.callback()}callback(){this.done=!0,this.loading=!1,this.callbacks.forEach(e=>{e(this.onerrorEvent)}),this.callbacks=[]}execute(){if(this.resetIfRetryingFailed(),!this.loading)if(this.done)this.callback();else{if(window.google&&window.google.maps&&window.google.maps.version){console.warn("Google Maps already loaded outside @googlemaps/js-api-loader. This may result in undesirable behavior as options and script parameters may not match."),this.callback();return}this.loading=!0,this.setScript()}}}var f=r(52735),b=r(17019),w=r(52368);let v={GOOGLE:w.Cu.GOOGLE_MAPS_API_KEY,NAVER_CLIENT_ID:w.Cu.NAVER_MAPS_CLIENT_ID};r(95155),r(45129),r(64962);let y=v.GOOGLE;v.NAVER_CLIENT_ID;let j={TRANSITION_DURATION:"0.5s",TRANSITION_TIMING:"cubic-bezier(0.4, 0, 0.2, 1)"},N=[{id:"1",title:"스타벅스 강남점",distance:.3,address:"서울시 강남구 역삼동 123-45",tel:"02-1234-5678",url:"https://www.starbucks.co.kr"},{id:"2",title:"투썸플레이스 서초점",distance:.5,address:"서울시 서초구 서초동 456-78",tel:"02-2345-6789",url:"https://www.twosome.co.kr"}];new x({apiKey:y,version:"weekly",libraries:["places"],id:"google-maps-script"});let S=`
@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-slideUp {
  animation: slideUp 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.animate-fadeIn {
  animation: fadeIn 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* 지도 화면 전체 차지하기 위한 스타일 */
.full-map-container {
  position: fixed;
  top: 0; /* 헤더 아래부터 시작하지 않고 화면 최상단부터 시작 */
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  z-index: 5;
}

.map-wrapper {
  width: 100%;
  height: 100%;
  position: fixed;
  top: 60px; /* 헤더 높이만큼 아래에서 시작 */
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  padding: 0;
}

/* Bottom Sheet 스타일 */
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: white;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
              bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1); /* 0.4s와 0.2s delay → 0.5s로 변경하여 바텀시트와 동일하게 */
  z-index: 40;
  max-height: 90vh;
  /* overflow-y: auto; */ /* 제거 - 내부 컨텐츠 래퍼가 담당 */
  touch-action: pan-y; /* 시트 자체 드래그를 위함 */
  /* padding-bottom: 20px; */ /* 제거 - 내부 컨텐츠 래퍼가 담당 */
  will-change: transform;
}

.bottom-sheet-handle {
  width: 40px;
  height: 5px;
  background-color: #e2e8f0;
  border-radius: 3px;
  margin: 8px auto;
  cursor: grab;
}

.bottom-sheet-handle:active {
  cursor: grabbing;
}

.bottom-sheet-collapsed {
  transform: translateY(calc(100% - 100px));
  min-height: 100vh;
}

.bottom-sheet-middle {
  transform: translateY(68%);
  min-height: 100vh;
}

.bottom-sheet-expanded {
  transform: translateY(0%);
  height: 85vh; /* 고정 높이 추가 조정 (88vh -> 85vh) */
  overflow-y: hidden !important; /* 중요: 시트 자체는 스크롤되지 않음 */
  display: flex !important;
  flex-direction: column !important;
}

/* 맵 헤더 스타일 - 바텀시트 위치에 따라 이동하도록 수정 */
.map-header {
  position: fixed;
  left: 16px;
  right: auto;
  width: 60px;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.7); /* 어두운 배경색으로 변경 */
  color: white; /* 텍스트 색상을 흰색으로 변경 */
  padding: 6px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
              bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1); /* opacity delay 제거, bottom과 동일 시간 */
  max-width: 60px;
}

.map-controls {
  position: fixed;
  right: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
              bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1); /* visibility 제외하여 즉시 처리 */
}

/* 바텀시트 상태에 따른 헤더 위치 */
.header-collapsed {
  bottom: 120px; /* 바텀시트 높이(150px) + 간격(15px) */
  top: auto;
  opacity: 1;
  visibility: visible;
}

.header-middle {
  bottom: calc(33vh + 10px); 
  top: auto;
  opacity: 1;
  visibility: visible;
}

.header-expanded {
  opacity: 0;
  visibility: hidden;
}

/* 컨트롤 버튼 위치 별도 관리 */
.controls-collapsed {
  bottom: 120px; /* 바텀시트 높이(150px) + 간격(15px) - 헤더와 동일한 위치 */
  top: auto;
  opacity: 1;
  visibility: visible;
}

.controls-middle {
  bottom: calc(33vh + 10px); /* 바텀시트 중간 높이 + 간격(15px) - 헤더와 동일한 위치 */
  top: auto;
  opacity: 1;
  visibility: visible;
}

.controls-expanded {
  bottom: calc(33vh + 10px); /* middle 상태와 동일한 위치 유지 */
  opacity: 0;
  visibility: hidden;
  transition: none; /* 즉시 사라지도록 transition 제거 */
}

.map-control-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.7);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  color: #EEF2FF;
  transition: all 0.2s;
}

.map-control-button:hover {
  background-color: rgba(0, 0, 0, 0.7);
  transform: translateY(-1px);
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.15);
}

/* 섹션 구분선 스타일 추가 */
.section-divider {
  height: 1px;
  background: #f2f2f2;
  margin: 16px 0;
  width: 100%;
}

.section-title {
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: #424242;
  font-weight: normal;
}

.content-section {
  padding: 16px;
  background-color: #ffffff;
  border-radius: 12px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.content-section::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.members-section {
  background: linear-gradient(to right, rgba(22, 163, 74, 0.03), transparent); /* Indigo to Green gradient */
}

.members-section::before {
  background-color: #16A34A; /* Indigo (#4F46E5) to Green-600 (#16A34A) */
}

.schedule-section {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.03), transparent);
}

.schedule-section::before {
  background-color: #EC4899; /* 핑크 색상 */
}

.places-section {
  background: linear-gradient(to right, rgba(234, 179, 8, 0.03), transparent);
}

.places-section::before {
  background-color: #EAB308; /* 노란색 색상 */
}

/* 스크롤바 숨김 스타일 */
.hide-scrollbar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}
.hide-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
`,k="force-dynamic",_=(e,t)=>{let r=t%4+1;return 1===e?`/images/male_${r}.png`:2===e?`/images/female_${r}.png`:`/images/avatar${t%3+1}.png`},$={1:"\uD83C\uDF25️",2:"☁️",3:"\uD83C\uDF26️",4:"\uD83C\uDF27️",5:"\uD83C\uDF28️",6:"❄️",7:"\uD83D\uDCA8",8:"☀️",default:"\uD83C\uDF21️"},I={1:"구름많음",2:"흐림",3:"흐리고 비",4:"비",5:"비/눈",6:"눈",7:"눈날림",8:"맑음",default:"날씨 정보 없음"},E=(e,t)=>{let r=String(e||"default"),s=$[r]||$.default,n=I[r]||I.default,i="--\xb0C";return"number"==typeof t?i=`${Math.round(t)}\xb0C`:"string"!=typeof t||isNaN(parseFloat(t))?null==t||(i=String(t)):i=`${Math.round(parseFloat(t))}\xb0C`,{temp:i,condition:n,icon:s,skyStatus:r}};function A(){let e=(0,d.useRouter)(),[t,r]=(0,a.useState)("사용자"),[s,i]=(0,a.useState)({lat:37.5642,lng:127.0016}),[l,h]=(0,a.useState)("서울시"),[g,x]=(0,a.useState)(N),[w,v]=(0,a.useState)([{id:"1",name:"회사",address:"서울시 강남구 테헤란로 123"},{id:"2",name:"자주 가는 카페",address:"서울시 강남구 역삼동 234"}]),[y,k]=(0,a.useState)([]),[$,I]=(0,a.useState)([]),[A,C]=(0,a.useState)(()=>(0,u.GP)(new Date,"yyyy-MM-dd")),[M,L]=(0,a.useState)(E(null,null)),[R,P]=(0,a.useState)(!0),[T,z]=(0,a.useState)(!1),[O,G]=(0,a.useState)("google"),[B,F]=(0,a.useState)(!1),[U,D]=(0,a.useState)(!1),[q,W]=(0,a.useState)([]),Y=(0,a.useRef)(null),K=(0,a.useRef)(null),V=(0,a.useRef)(null),Z=(0,a.useRef)(null),H=(0,a.useRef)(null),J=(0,a.useRef)(null),X=(0,a.useRef)([]);(0,a.useRef)([]);let[Q,ee]=(0,a.useState)({google:!1,naver:!1}),[et,er]=(0,a.useState)("collapsed"),es=(0,a.useRef)(null),en=(0,a.useRef)(null),ei=(0,a.useRef)(null),eo=(0,a.useRef)(!1),ea=(0,a.useRef)({members:!1,schedules:!1}),[el,ec]=(0,a.useState)(!1),ed=(0,a.useRef)(null),[eu,ep]=(0,a.useState)([]),[em,eh]=(0,a.useState)(!1),[eg,ex]=(0,a.useState)([]),[ef,eb]=(0,a.useState)(null),[ew,ev]=(0,a.useState)(!1),[ey,ej]=(0,a.useState)(!1),[eN,eS]=(0,a.useState)(!1),ek=e=>{let t=e.target;!(t.closest("button")||t.closest("a"))&&(en.current="touches"in e?e.touches[0].clientY:e.clientY,eo.current=!0,ei.current=Date.now(),es.current&&(es.current.style.transition="none"))},e_=e=>{if(!eo.current||null===en.current)return;let t=("touches"in e?e.touches[0].clientY:e.clientY)-en.current;if(30>Math.abs(t))return;let r=et;t<0?"collapsed"===et?r="middle":"middle"===et&&(r="expanded"):"expanded"===et?r="middle":"middle"===et&&(r="collapsed"),r!==et&&(console.log("[BOTTOM_SHEET] 드래그로 상태 변경:",et,"→",r),er(r),es.current&&(es.current.style.transition=`transform ${j.TRANSITION_DURATION} ${j.TRANSITION_TIMING}`),en.current=null,eo.current=!1,ei.current=null)},e$=e=>{let t=e.target;if(t.closest("button")||t.closest("a")||!eo.current||null===en.current)return;let r=("changedTouches"in e?e.changedTouches[0].clientY:e.clientY)-en.current,s=ei.current?Date.now()-ei.current:0;if(10>Math.abs(r)&&s<200){let e=et;"collapsed"===et?e="middle":"middle"===et&&(e="expanded"),console.log("[BOTTOM_SHEET] 탭으로 상태 변경:",et,"→",e),er(e)}es.current&&(es.current.style.transition=`transform ${j.TRANSITION_DURATION} ${j.TRANSITION_TIMING}`),en.current=null,eo.current=!1,ei.current=null},eI=e=>"number"==typeof e?e:"string"!=typeof e||isNaN(parseFloat(e))?null:parseFloat(e),eE=e=>{eo.current=!1,en.current=null,ei.current=null;let t=y.map(t=>t.id===e?{...t,isSelected:!t.isSelected}:{...t,isSelected:!1});k(t);let r=t.find(e=>e.isSelected);!em&&r&&(eh(!0),console.log("[HOME] 첫번째 멤버 선택 완료:",r.name)),r?(L(E(String(r.mt_weather_sky??"default"),r.mt_weather_tmx)),I(r.schedules.filter(e=>"string"==typeof e.date&&e.date.startsWith(A)))):(ed.current&&L(ed.current),I(eu.filter(e=>"string"==typeof e.date&&e.date.startsWith(A)).map(({memberId:e,...t})=>t))),eC(t)},eA=e=>{C(e);let t=y.find(e=>e.isSelected);t?I(t.schedules.filter(t=>"string"==typeof t.date&&t.date.startsWith(e))):I(eu.filter(t=>"string"==typeof t.date&&t.date.startsWith(e)).map(({memberId:e,...t})=>t))},eC=e=>{if(X.current.length>0&&(X.current.forEach(e=>{e&&e.setMap&&e.setMap(null)}),X.current=[]),e.length>0){e.forEach((e,t)=>{let r=eI(e.location.lat),s=eI(e.location.lng);if(null!==r&&null!==s&&0!==r&&0!==s){if("naver"===O&&H.current&&window.naver?.maps){let t=e.photo??_(e.mt_gender,e.original_index),n=new window.naver.maps.LatLng(r,s),i=e.isSelected?"#EC4899":"#4F46E5",o=new window.naver.maps.Marker({position:n,map:H.current,icon:{content:`
                  <div style="position: relative; text-align: center;">
                    <div style="width: 32px; height: 32px; background-color: white; border: 2px solid ${i}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                      <img 
                        src="${t}" 
                        alt="${e.name}" 
                        style="width: 100%; height: 100%; object-fit: cover;" 
                        data-gender="${e.mt_gender??""}" 
                        data-index="${e.original_index}"
                        onerror="
                          const genderStr = this.getAttribute('data-gender');
                          const indexStr = this.getAttribute('data-index');
                          const gender = genderStr ? parseInt(genderStr, 10) : null;
                          const idx = indexStr ? parseInt(indexStr, 10) : 0;
                          const imgNum = (idx % 4) + 1;
                          let fallbackSrc = '/images/avatar' + ((idx % 3) + 1) + '.png';
                          if (gender === 1) { fallbackSrc = '/images/male_' + imgNum + '.png'; }
                          else if (gender === 2) { fallbackSrc = '/images/female_' + imgNum + '.png'; }
                          this.src = fallbackSrc;
                          this.onerror = null;
                        "
                      />
                    </div>
                    <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.7); color: white; padding: 2px 5px; border-radius: 3px; white-space: nowrap; font-size: 10px;">
                      ${e.name}
                    </div>
                  </div>
                `,size:new window.naver.maps.Size(36,48),anchor:new window.naver.maps.Point(18,42)},zIndex:e.isSelected?200:150});X.current.push(o)}else if("google"===O&&V.current&&window.google?.maps){let t=e.photo??_(e.mt_gender,e.original_index),n=new window.google.maps.Marker({position:{lat:r,lng:s},map:V.current,title:e.name,icon:{url:t,scaledSize:new window.google.maps.Size(32,32),origin:new window.google.maps.Point(0,0),anchor:new window.google.maps.Point(16,16)},zIndex:e.isSelected?200:150});X.current.push(n)}}else console.warn("유효하지 않은 멤버 좌표:",e.name,e.location)});let t=e.find(e=>e.isSelected);if(t){let e=eI(t.location.lat),r=eI(t.location.lng);null!==e&&null!==r&&0!==e&&0!==r?"naver"===O&&H.current&&U?setTimeout(()=>{H.current.setCenter(new window.naver.maps.LatLng(e,r)),H.current.setZoom(17),console.log("네이버 지도 중심 이동:",t.name,{lat:e,lng:r})},100):"google"===O&&V.current&&B&&setTimeout(()=>{V.current.panTo({lat:e,lng:r}),V.current.setZoom(17),console.log("구글 지도 중심 이동:",t.name,{lat:e,lng:r})},100):console.warn("유효하지 않은 멤버 좌표:",t.name,t.location)}else if(e.length>0){let t=e.filter(e=>{let t=eI(e.location.lat),r=eI(e.location.lng);return null!==t&&null!==r&&0!==t&&0!==r});if(t.length>0){if("naver"===O&&H.current){let e=new window.naver.maps.LatLngBounds;t.forEach(t=>{let r=eI(t.location.lat),s=eI(t.location.lng);null!==r&&null!==s&&e.extend(new window.naver.maps.LatLng(r,s))}),setTimeout(()=>{H.current.fitBounds(e,{padding:{top:50,right:50,bottom:50,left:50}})},100)}else if("google"===O&&V.current){let e=new window.google.maps.LatLngBounds;t.forEach(t=>{let r=eI(t.location.lat),s=eI(t.location.lng);null!==r&&null!==s&&e.extend({lat:r,lng:s})}),setTimeout(()=>{V.current.fitBounds(e)},100)}}}}},eM=()=>{navigator.geolocation&&navigator.geolocation.getCurrentPosition(e=>{let{longitude:t,latitude:r}=e.coords;if(i({lat:r,lng:t}),z(!0),h("현재 위치"),"naver"===O&&H.current&&U){let e=new window.naver.maps.LatLng(r,t);H.current.setCenter(e),H.current.setZoom(14),J.current&&J.current.setPosition(e)}else"google"===O&&V.current&&B&&(V.current.panTo({lat:r,lng:t}),V.current.setZoom(14),Z.current&&Z.current.setPosition({lat:r,lng:t}))},e=>{console.error("위치 정보를 가져올 수 없습니다:",e)})},eL=e=>e<1?`${(1e3*e).toFixed(0)}m`:`${e.toFixed(1)}km`,eR=async e=>{console.log("[handleGroupSelect] 그룹 선택:",e),eb(e),ej(!1),er("collapsed"),k([]),ep([]),I([]),eS(!1),eh(!1),ea.current={members:!1,schedules:!1},console.log("[handleGroupSelect] 기존 데이터 초기화 완료, 새 그룹 데이터 로딩 시작")};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(o(),{id:S.__hash,children:S}),(0,n.jsxs)(m.LN,{title:"홈",showTitle:!1,showBackButton:!1,showHeader:!1,className:"p-0 m-0 w-full h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100",children:[(0,n.jsxs)("div",{className:"full-map-container",children:[(R||!ea.current.members||!ea.current.schedules||!em)&&(0,n.jsx)(f.A,{message:R?"지도를 불러오는 중입니다...":ea.current.members?ea.current.schedules?"첫번째 멤버 위치로 이동 중입니다...":"그룹 일정을 불러오는 중입니다...":"데이터를 불러오는 중입니다...",fullScreen:!0,type:"ripple",size:"md",color:"indigo"}),(0,n.jsx)("div",{ref:Y,style:{display:"google"===O?"block":"none",zIndex:6},className:"w-full h-full absolute top-0 left-0"}),(0,n.jsx)("div",{ref:K,style:{display:"naver"===O?"block":"none",zIndex:6},className:"w-full h-full absolute top-0 left-0"})]}),!(R||!ea.current.members||!ea.current.schedules||!em)&&(0,n.jsxs)("div",{className:`map-header ${(()=>{switch(et){case"collapsed":default:return"header-collapsed";case"middle":return"header-middle";case"expanded":return"header-expanded"}})()}`,children:[T&&(0,n.jsxs)("span",{className:"absolute top-1 right-1 inline-flex items-center justify-center w-2 h-2",children:[(0,n.jsx)("span",{className:"animate-ping absolute inline-flex h-2 w-2 rounded-full bg-pink-400 opacity-75"}),(0,n.jsx)("span",{className:"relative inline-flex rounded-full h-2 w-2 bg-pink-500"})]}),(0,n.jsxs)("div",{className:"flex flex-col items-center w-full",children:[(0,n.jsx)("span",{className:"text-lg",children:M.icon}),(0,n.jsx)("span",{className:"text-sm font-medium",children:M.temp}),(0,n.jsx)("span",{className:"text-xs text-white",children:M.condition})]})]}),!(R||!ea.current.members||!ea.current.schedules||!em)&&(0,n.jsx)("div",{className:`map-controls ${(()=>{switch(et){case"collapsed":default:return"controls-collapsed";case"middle":return"controls-middle";case"expanded":return"controls-expanded"}})()}`,children:(0,n.jsx)("button",{onClick:()=>eM(),"aria-label":"내 위치로 이동",className:"map-control-button",children:(0,n.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",className:"h-5 w-5",children:[(0,n.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"}),(0,n.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M15 11a3 3 0 11-6 0 3 3 0 016 0z"})]})})}),!(R||!ea.current.members||!ea.current.schedules||!em)&&(0,n.jsxs)("div",{ref:es,style:{touchAction:"pan-x"},onTouchStart:ek,onTouchMove:e_,onTouchEnd:e$,onMouseDown:ek,onMouseMove:e_,onMouseUp:e$,onMouseLeave:e$,className:`bottom-sheet ${(()=>{if(R||!ea.current.members||!ea.current.schedules||!em)return"bottom-sheet-collapsed";switch(et){case"collapsed":default:return"bottom-sheet-collapsed";case"middle":return"bottom-sheet-middle";case"expanded":return"bottom-sheet-expanded"}})()}`,children:[(0,n.jsx)("div",{className:"bottom-sheet-handle"}),(0,n.jsxs)("div",{style:"expanded"!==et?{WebkitOverflowScrolling:"touch",touchAction:"pan-y"}:{},className:`
                w-full
                ${"expanded"===et?"flex flex-col flex-grow min-h-0":"px-4 pb-8 overflow-y-auto h-full"}
              `,children:[(0,n.jsxs)("div",{style:"expanded"!==et?{touchAction:"auto"}:{},onClick:"expanded"!==et?e=>e.stopPropagation():void 0,className:`
                content-section members-section 
                min-h-[180px] max-h-[180px] overflow-y-auto /* 자체 콘텐츠가 많을 경우 스크롤 */
                ${"expanded"===et?"flex-shrink-0 mx-4 mt-2 mb-3":"mb-3 sm:mb-0"}
              `,children:[(0,n.jsxs)("h2",{className:"text-lg text-gray-900 flex justify-between items-center section-title",children:[(0,n.jsx)("div",{className:"flex items-center space-x-3",children:(0,n.jsx)("span",{children:"그룹 멤버"})}),(0,n.jsxs)("div",{className:"flex items-center space-x-2",children:[(0,n.jsxs)("div",{className:"relative",children:[(0,n.jsxs)("button",{onClick:e=>{e.stopPropagation(),ej(!ey)},disabled:ew,"data-group-selector":"true",className:"flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px]",children:[(0,n.jsx)("span",{className:"truncate text-gray-700",children:ew?"로딩 중...":eg.find(e=>e.sgt_idx===ef)?.sgt_title||"그룹 선택"}),(0,n.jsx)("div",{className:"ml-1 flex-shrink-0",children:ew?(0,n.jsx)(b.TwU,{className:"animate-spin h-3 w-3 text-gray-400"}):(0,n.jsx)(b.fK4,{className:`text-gray-400 transition-transform duration-200 h-3 w-3 ${ey?"rotate-180":""}`})})]}),ey&&eg.length>0&&(0,n.jsx)("div",{className:"absolute top-full right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto min-w-[160px]",children:eg.map(e=>(0,n.jsx)("button",{onClick:t=>{t.stopPropagation(),eR(e.sgt_idx)},className:`w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 focus:outline-none focus:bg-indigo-50 ${ef===e.sgt_idx?"bg-indigo-50 text-indigo-700 font-medium":"text-gray-900"}`,children:(0,n.jsxs)("div",{className:"flex items-center justify-between",children:[(0,n.jsx)("span",{className:"truncate",children:e.sgt_title||`그룹 ${e.sgt_idx}`}),ef===e.sgt_idx&&(0,n.jsx)("span",{className:"text-indigo-500 ml-2",children:"✓"})]})},e.sgt_idx))})]}),(0,n.jsxs)(c(),{href:"/group",className:"inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",children:[(0,n.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20",fill:"currentColor",className:"h-4 w-4 mr-1",children:(0,n.jsx)("path",{fillRule:"evenodd",d:"M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z",clipRule:"evenodd"})}),"그룹 관리"]})]})]}),y.length>0?(0,n.jsx)("div",{className:"flex flex-row flex-nowrap justify-start items-center gap-x-4 mb-2 overflow-x-auto hide-scrollbar px-2 py-2",children:y.map((e,t)=>(0,n.jsx)("div",{className:"flex flex-col items-center p-0 flex-shrink-0",children:(0,n.jsxs)("button",{onClick:t=>{t.stopPropagation(),eE(e.id)},onTouchStart:e=>e.stopPropagation(),onTouchMove:e=>e.stopPropagation(),onTouchEnd:e=>e.stopPropagation(),className:"flex flex-col items-center",children:[(0,n.jsx)("div",{className:`w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 ${e.isSelected?"border-indigo-500 ring-2 ring-indigo-300 scale-110":"border-transparent"}`,children:(0,n.jsx)("img",{src:e.photo??_(e.mt_gender,e.original_index),alt:e.name,onError:t=>{let r=t.target;r.src=_(e.mt_gender,e.original_index),r.onerror=null},className:"w-full h-full object-cover"})}),(0,n.jsx)("span",{className:`block text-xs font-medium mt-1 ${e.isSelected?"text-indigo-700":"text-gray-900"}`,children:e.name})]})},e.id))}):(0,n.jsx)("div",{className:"text-center py-3 text-gray-500",children:(0,n.jsx)("p",{children:"그룹에 참여한 멤버가 없습니다"})})]}),(0,n.jsxs)("div",{style:"expanded"===et?{WebkitOverflowScrolling:"touch",touchAction:"auto"}:{},onClick:"expanded"===et?e=>e.stopPropagation():void 0,className:`
                ${"expanded"===et?"flex-grow min-h-0 overflow-y-auto hide-scrollbar px-4 pb-16":""}
              `,children:[(0,n.jsxs)("div",{className:`content-section schedule-section ${"expanded"!==et?"":"mt-0"}`,children:[(0,n.jsxs)("h2",{className:"text-lg text-gray-900 flex justify-between items-center section-title",children:[y.find(e=>e.isSelected)?.name?`${y.find(e=>e.isSelected)?.name}의 일정`:"오늘의 일정",y.some(e=>e.isSelected)?(0,n.jsxs)("button",{onClick:t=>{t.stopPropagation();let r=y.find(e=>e.isSelected);r&&e.push(`/schedule/add?memberId=${r.id}&memberName=${r.name}&from=home`)},className:"inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",children:[(0,n.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20",fill:"currentColor",className:"h-4 w-4 mr-1",children:(0,n.jsx)("path",{fillRule:"evenodd",d:"M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z",clipRule:"evenodd"})}),"일정 추가"]}):(0,n.jsxs)(c(),{href:"/schedule",className:"text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center",children:["더보기",(0,n.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20",fill:"currentColor",className:"h-4 w-4 ml-1",children:(0,n.jsx)("path",{fillRule:"evenodd",d:"M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z",clipRule:"evenodd"})})]})]}),(0,n.jsx)("div",{className:"mb-3 overflow-x-auto pb-2 hide-scrollbar",children:(0,n.jsx)("div",{className:"flex space-x-2",children:q.map((e,t)=>(0,n.jsx)("button",{onClick:t=>{t.stopPropagation(),eA(e.value)},className:`px-3 py-2 rounded-lg flex-shrink-0 focus:outline-none transition-colors ${A===e.value?"bg-gray-900 text-white font-medium shadow-sm":"bg-gray-100 text-gray-700 hover:bg-gray-200"}`,children:(0,n.jsx)("div",{className:"text-center",children:(0,n.jsx)("div",{className:"text-xs",children:e.display})})},t))})}),$.length>0?(0,n.jsx)("ul",{className:"space-y-3",children:$.map(e=>{let t="시간 정보 없음";if(e.date)try{let r=new Date(e.date);isNaN(r.getTime())||(t=(0,u.GP)(r,"a h:mm",{locale:p.ko}))}catch(e){console.error("Error formatting schedule date:",e)}let r=e.location||e.slt_idx_t;return(0,n.jsxs)("li",{className:"p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors relative",children:[" ",(0,n.jsxs)(c(),{href:`/schedule/${e.id}`,className:"block",children:[(0,n.jsx)("h3",{className:"font-medium text-gray-900 text-base mb-1",children:e.title}),(0,n.jsxs)("div",{className:"flex items-center text-sm text-gray-700 mb-1",children:[(0,n.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",className:"h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0",children:(0,n.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"})}),(0,n.jsx)("span",{className:"text-gray-600",children:t})," "]}),r&&(0,n.jsxs)("div",{className:"text-sm flex items-center",children:[(0,n.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",className:"h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0",children:(0,n.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"})}),(0,n.jsx)("span",{className:"text-gray-500",children:r})," "]}),(0,n.jsx)("div",{className:"absolute right-3 top-1/2 transform -translate-y-1/2",children:(0,n.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",className:"h-5 w-5 text-gray-400",children:(0,n.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 5l7 7-7 7"})})})]})]},e.id)})}):(0,n.jsx)("div",{className:"text-center py-4 text-gray-500 bg-gray-50 rounded-lg",children:(0,n.jsx)("p",{children:y.some(e=>e.isSelected)?"선택한 멤버의 일정이 없습니다":"오늘 일정이 없습니다"})})]}),(0,n.jsx)("div",{className:`transition-all duration-300 ${"expanded"===et?"opacity-100":"opacity-0 hidden"}`,children:(0,n.jsxs)("div",{className:`content-section places-section ${"expanded"===et?"mt-3 mb-2":"mb-12"}`,children:[(0,n.jsxs)("h2",{className:"text-lg text-gray-900 flex justify-between items-center section-title",children:["내 주변 장소",(0,n.jsxs)(c(),{href:"/location/nearby",className:"inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",children:["더보기",(0,n.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20",fill:"currentColor",className:"h-4 w-4 ml-1",children:(0,n.jsx)("path",{fillRule:"evenodd",d:"M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z",clipRule:"evenodd"})})]})]}),g.length>0?(0,n.jsx)("ul",{className:"space-y-3",children:g.map(e=>(0,n.jsx)("li",{className:"p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors",children:(0,n.jsxs)(c(),{href:`/location/place/${e.id}`,className:"block",children:[(0,n.jsxs)("div",{className:"flex justify-between",children:[(0,n.jsx)("h3",{className:"font-medium text-gray-900",children:e.title}),(0,n.jsx)("span",{className:"text-sm text-indigo-600 font-medium",children:eL(e.distance)})]}),(0,n.jsx)("div",{className:"text-sm text-gray-500 mt-1",children:(0,n.jsxs)("div",{className:"inline-flex items-center",children:[(0,n.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",className:"h-4 w-4 mr-1 text-gray-400",children:(0,n.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"})}),e.address]})})]})},e.id))}):(0,n.jsx)("div",{className:"text-center py-3 text-gray-500",children:"주변 장소가 없습니다"})]})})]})]})]})]})]})}},79551:e=>{"use strict";e.exports=require("url")},81057:(e,t,r)=>{Promise.resolve().then(r.bind(r,94897))},81630:e=>{"use strict";e.exports=require("http")},83997:e=>{"use strict";e.exports=require("tty")},90327:(e,t,r)=>{"use strict";r.d(t,{f:()=>i});var s=r(47138),n=r(35780);function i(e,t){let r=(0,s.a)(e);return isNaN(t)?(0,n.w)(e,NaN):(t&&r.setDate(r.getDate()+t),r)}},94735:e=>{"use strict";e.exports=require("events")},94897:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>o});var s=r(60687),n=r(52639),i=r(43210);function o({children:e}){return(0,s.jsx)(i.Suspense,{fallback:(0,s.jsx)("div",{children:"Loading..."}),children:(0,s.jsx)(n.e7,{children:e})})}},95155:(e,t,r)=>{"use strict";r.d(t,{A:()=>i});var s=r(45129);class n{async getAllMembers(){try{return(await s.A.get("/members")).data}catch(e){return console.log("서버 API 호출 실패, 목 데이터 반환:",e),[{mt_idx:1,mt_name:"김철수",mt_file1:"/images/avatar1.png",mt_lat:"37.5692",mt_long:"127.0036"},{mt_idx:2,mt_name:"이영희",mt_file1:"/images/avatar2.png",mt_lat:"37.5612",mt_long:"126.9966"}]}}async getMemberById(e){try{return(await s.A.get(`/members/${e}`)).data}catch(e){return console.log("서버 API 호출 실패, 목 데이터 반환:",e),{mt_idx:1,mt_name:"김철수",mt_file1:"/images/avatar1.png",mt_lat:"37.5692",mt_long:"127.0036"}}}async getGroupMembers(e){try{console.log("[MEMBER SERVICE] 그룹 멤버 조회 시작:",e);let t=await s.A.get(`/group-members/member/${e}`);return console.log("[MEMBER SERVICE] 그룹 멤버 조회 응답:",t.data),t.data}catch(e){return console.error("[MEMBER SERVICE] 서버 API 호출 실패, 목 데이터 반환:",e),[{mt_idx:1186,mt_name:"김철수",mt_file1:"/images/avatar3.png",mt_lat:"37.5692",mt_long:"127.0036"},{mt_idx:1187,mt_name:"이영희",mt_file1:"/images/avatar1.png",mt_lat:"37.5612",mt_long:"126.9966"},{mt_idx:1188,mt_name:"박민수",mt_file1:"/images/avatar2.png",mt_lat:"37.5662",mt_long:"126.9986"}]}}async addMember(e){return(await s.A.post("/members",e)).data}async updateMember(e,t){return(await s.A.put(`/members/${e}`,t)).data}async deleteMember(e){return(await s.A.delete(`/members/${e}`)).data}async updateMemberLocation(e,t,r){return(await s.A.patch(`/members/${e}/location`,{mt_lat:t,mt_long:r})).data}}let i=new n}};var t=require("../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[4447,4359,7019,1772,6693,5111],()=>r(68572));module.exports=s})();