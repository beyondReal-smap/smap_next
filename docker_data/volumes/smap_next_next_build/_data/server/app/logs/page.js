(()=>{var e={};e.id=524,e.ids=[524],e.modules={3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},8607:(e,t,r)=>{"use strict";r.r(t),r.d(t,{GlobalError:()=>a.a,__next_app__:()=>m,pages:()=>c,routeModule:()=>u,tree:()=>d});var n=r(65239),o=r(48088),s=r(88170),a=r.n(s),i=r(30893),l={};for(let e in i)0>["default","tree","pages","GlobalError","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>i[e]);r.d(t,l);let d={children:["",{children:["logs",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(r.bind(r,81076)),"/app/src/app/logs/page.tsx"]}]},{layout:[()=>Promise.resolve().then(r.bind(r,66431)),"/app/src/app/logs/layout.tsx"]}]},{layout:[()=>Promise.resolve().then(r.bind(r,78623)),"/app/src/app/layout.tsx"],"not-found":[()=>Promise.resolve().then(r.t.bind(r,57398,23)),"next/dist/client/components/not-found-error"],forbidden:[()=>Promise.resolve().then(r.t.bind(r,89999,23)),"next/dist/client/components/forbidden-error"],unauthorized:[()=>Promise.resolve().then(r.t.bind(r,65284,23)),"next/dist/client/components/unauthorized-error"]}]}.children,c=["/app/src/app/logs/page.tsx"],m={require:r,loadChunk:()=>Promise.resolve()},u=new n.AppPageRouteModule({definition:{kind:o.RouteKind.APP_PAGE,page:"/logs/page",pathname:"/logs",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:d}})},10220:(e,t,r)=>{Promise.resolve().then(r.bind(r,32586))},10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:e=>{"use strict";e.exports=require("next/dist/server/app-render/action-async-storage.external.js")},19463:(e,t,r)=>{Promise.resolve().then(r.bind(r,32573))},20192:(e,t,r)=>{"use strict";r.d(t,{f:()=>s});var n=r(87981),o=r(23711);function s(e,t,r){let s=(0,o.a)(e,r?.in);return isNaN(t)?(0,n.w)(r?.in||e,NaN):(t&&s.setDate(s.getDate()+t),s)}},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},32573:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>a});var n=r(60687),o=r(52639),s=r(43210);function a({children:e}){return(0,n.jsx)(s.Suspense,{fallback:(0,n.jsx)("div",{children:"Loading..."}),children:(0,n.jsx)(o.e7,{children:e})})}},32586:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>y,dynamic:()=>f});var n=r(60687),o=r(76180),s=r.n(o),a=r(43210),i=r(16189),l=r(85814),d=r.n(l),c=r(58709),m=r(53201),u=r(32601),p=r(52639),h=r(17019),x=r(52368);let f="force-dynamic";x.Cu.NAVER_MAPS_CLIENT_ID;let g=[{id:"h_gm_1",name:"김철수",photo:"/images/avatar3.png",isSelected:!1,location:{lat:37.5692,lng:127.0016+.002},schedules:[]},{id:"h_gm_2",name:"이영희",photo:"/images/avatar1.png",isSelected:!1,location:{lat:37.5612,lng:126.9966},schedules:[]}],b={distance:"12.5 km",time:"2시간 30분",steps:"15,203 걸음"},v=[{id:"1",type:"schedule",action:"create",title:"팀 미팅 일정이 생성되었습니다.",description:"9월 15일 오후 2시 - 강남 사무실",user:"김철수",timestamp:"2023-09-10T14:32:00"},{id:"2",type:"location",action:"update",title:"장소 정보가 업데이트되었습니다.",description:"강남 사무실 - 주소 변경",user:"이영희",timestamp:"2023-09-09T11:15:00"},{id:"3",type:"group",action:"add_member",title:"그룹원이 추가되었습니다.",description:"개발팀 - 박지민 추가",user:"김철수",timestamp:"2023-09-08T16:45:00"},{id:"4",type:"schedule",action:"delete",title:"일정이 취소되었습니다.",description:"9월 12일 프로젝트 중간점검 - 취소",user:"이영희",timestamp:"2023-09-07T09:20:00"},{id:"5",type:"location",action:"create",title:"새 장소가 등록되었습니다.",description:"을지로 오피스 - 추가됨",user:"김철수",timestamp:"2023-09-06T13:10:00"},{id:"6",type:"group",action:"remove_member",title:"그룹원이 제거되었습니다.",description:"마케팅팀 - 홍길동 제거",user:"정민지",timestamp:"2023-09-05T15:30:00"},{id:"7",type:"schedule",action:"update",title:"일정이 수정되었습니다.",description:"9월 20일 고객 미팅 - 시간 변경",user:"이영희",timestamp:"2023-09-04T10:25:00"}],w=`
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
  animation: slideUp 0.3s ease-out forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out forwards;
}

.full-map-container {
  position: fixed;
  top: 0;
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

.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: white;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 40;
  max-height: 90vh;
  overflow-y: auto;
  touch-action: pan-y;
  padding-bottom: 20px;
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
  height: 100vh;
}

.bottom-sheet-expanded {
  transform: translateY(calc(58% - 40px));
  height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.hide-scrollbar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}
.hide-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

/* z-index는 location/page.tsx와 동일하게 유지 (모달 등 다른 요소 고려) */
.modal-overlay {
  z-index: 50;
}
.modal-content {
  z-index: 51;
}

/* --- home/page.tsx 에서 가져온 스타일 추가 시작 --- */
.section-divider {
  height: 1px;
  background: #f2f2f2;
  margin: 16px 0;
  width: 100%;
}

.section-title {
  margin-bottom: 10px; 
  padding-bottom: 6px; 
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: #424242;
  font-weight: normal;
}

.content-section {
  padding: 10px 16px; 
  background-color: #ffffff;
  border-radius: 12px;
  margin-bottom: 10px; 
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

.members-section { /* home 스타일과 다른 색상 적용 가능 */
  background: linear-gradient(to right, rgba(22, 163, 74, 0.03), transparent); /* Indigo to Green gradient */
}

.members-section::before {
  background-color: #16A34A; /* Green-500 for green line */
}

.schedule-section { /* home 스타일과 다른 색상 적용 가능 */
  background: linear-gradient(to right, rgba(236, 72, 153, 0.03), transparent);
}

.schedule-section::before {
  background-color: #EC4899;
}

/* --- 위치기록 요약 섹션 스타일 추가 --- */
.summary-section {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.03), transparent);
}

.summary-section::before {
  background-color: #EC4899;
}
/* --- home/page.tsx 에서 가져온 스타일 추가 끝 --- */
`;function y(){(0,i.useRouter)();let[e,t]=(0,a.useState)(g),[r,o]=(0,a.useState)((0,c.GP)(new Date,"yyyy-MM-dd")),l=(0,a.useRef)(null),x=(0,a.useRef)(null),f=(0,a.useRef)([]),[y,j]=(0,a.useState)(!1),[N,k]=(0,a.useState)(!0),[M,S]=(0,a.useState)("collapsed"),P=(0,a.useRef)(null),_=(0,a.useRef)(null),C=(0,a.useRef)(null),E=(0,a.useRef)(null),[$,R]=(0,a.useState)("members"),A=(0,a.useRef)(null),[z,T]=(0,a.useState)(b),[L,G]=(0,a.useState)(60),D=(0,a.useRef)(null),I=e=>{let t="touches"in e?e.touches[0].clientY:e.clientY;_.current=t,C.current=t,E.current=Date.now(),P.current&&(P.current.style.transition="none")},Y=e=>{if(null===_.current||!P.current||null===C.current)return;let t="touches"in e?e.touches[0].clientY:e.clientY,r=t-C.current;if(Math.abs(r)>5){C.current=t;let e=getComputedStyle(P.current).transform,n=0;"none"!==e&&(n=new DOMMatrixReadOnly(e).m42);let o=n+r,s=.6*window.innerHeight;o=Math.max(0-.1*window.innerHeight,Math.min(o,s+50)),P.current.style.transform=`translateY(${o}px)`,P.current.style.transition="none"}},q=e=>{if(null===_.current||!P.current||null===C.current)return;let t=("changedTouches"in e?e.changedTouches[0].clientY:e.clientY)-_.current,r=E.current?Date.now()-E.current:0;if(Math.abs(t)>10||r>200){let e;P.current.style.transition="transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)";let n=r>0?t/r:0,o=getComputedStyle(P.current).transform,s=0;"none"!==o&&(s=new DOMMatrixReadOnly(o).m42);let a=window.innerHeight;S(Math.abs(n)>.3?n<0?"expanded":"collapsed":s<.3*a?"expanded":"collapsed")}P.current.style.transform="",_.current=null,C.current=null,E.current=null},O=(r,n)=>{n.preventDefault(),n.stopPropagation(),console.log("Member selection started:",r);let o=e.map(e=>{let t=e.id===r;return console.log(`Updating member ${e.name}: isSelected = ${t}`),{...e,isSelected:t}});console.log("Updated members:",o),t(o),U(o),R("members"),S(M);let s=o.find(e=>e.isSelected);console.log("Selected member:",s?.name)},U=e=>{if(!x.current)return void console.warn("Map is not initialized");if(!window.naver?.maps)return void console.warn("Naver Maps API is not loaded");f.current.forEach(e=>e.setMap(null)),f.current=[];let t=e.filter(e=>e.isSelected);if(t.length>0&&(t.forEach(e=>{try{let t=new window.naver.maps.LatLng(e.location.lat,e.location.lng),r=new window.naver.maps.Marker({position:t,map:x.current,icon:{content:`<div style="position: relative; text-align: center;">
                <div style="width: 32px; height: 32px; background-color: white; border: 2px solid #4F46E5; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                  <img src="${e.photo}" alt="${e.name}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
                <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.7); color: white; padding: 2px 5px; border-radius: 3px; white-space: nowrap; font-size: 10px;">
                  ${e.name}
                </div>
              </div>`,size:new window.naver.maps.Size(36,48),anchor:new window.naver.maps.Point(18,42)},zIndex:150});f.current.push(r)}catch(e){console.error("Error creating marker:",e)}}),1===t.length)){let e=t[0];try{let t=new window.naver.maps.LatLng(e.location.lat,e.location.lng);x.current.panTo(t),x.current.setZoom(14),console.log("Map moved to member location:",e.name,e.location)}catch(e){console.error("Error moving map:",e)}}},F=e=>{o(e);let t=(20*Math.random()).toFixed(1),r=Math.floor(5*Math.random()),n=Math.floor(60*Math.random()),s=Math.floor(2e4*Math.random()).toLocaleString();T({distance:`${t} km`,time:`${r}시간 ${n}분`,steps:`${s} 걸음`}),G(Math.floor(101*Math.random())),R("members")};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(s(),{id:w.__hash,children:w}),(0,n.jsxs)(p.LN,{title:"활동 로그",showHeader:!1,showBackButton:!1,className:"p-0 m-0 w-full h-screen overflow-hidden",children:[N&&(0,n.jsxs)("div",{className:"absolute inset-0 flex items-center justify-center bg-gray-100 z-50",children:[" ",(0,n.jsx)("div",{className:"animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"})," "]}),(0,n.jsx)("div",{className:"full-map-container",children:(0,n.jsx)("div",{ref:l,className:"w-full h-full"})}),(0,n.jsxs)("div",{ref:P,onTouchStart:I,onTouchMove:Y,onTouchEnd:q,onMouseDown:I,onMouseMove:Y,onMouseUp:q,onMouseLeave:q,className:`bottom-sheet ${(()=>{switch(M){case"collapsed":default:return"bottom-sheet-collapsed";case"expanded":return"bottom-sheet-expanded"}})()} hide-scrollbar`,children:[(0,n.jsx)("div",{className:"bottom-sheet-handle"}),(0,n.jsxs)("div",{className:"px-4 pb-4",children:[(0,n.jsxs)("div",{ref:A,onScroll:()=>{if(A.current){let{scrollLeft:e,offsetWidth:t}=A.current;e>=t/2&&"summary"!==$?R("summary"):e<t/2&&"members"!==$&&R("members")}},className:"flex overflow-x-auto snap-x snap-mandatory hide-scrollbar mb-2 gap-2 bg-white",children:[(0,n.jsx)("div",{className:"w-full flex-shrink-0 snap-start overflow-hidden bg-white",children:(0,n.jsxs)("div",{className:"content-section members-section min-h-[220px] max-h-[220px] overflow-y-auto",children:[(0,n.jsxs)("h2",{className:"text-lg font-medium text-gray-900 flex justify-between items-center section-title",children:["그룹 멤버",(0,n.jsxs)(d(),{href:"/group",className:"inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",children:[(0,n.jsx)(h.GGD,{className:"h-3 w-3 mr-1"}),"그룹 관리"]})]}),e.length>0?(0,n.jsx)("div",{className:"flex flex-row flex-nowrap justify-start items-center gap-x-4 mb-2 overflow-x-auto hide-scrollbar px-2 py-2",children:e.map(e=>(0,n.jsx)("div",{className:"flex flex-col items-center p-0 flex-shrink-0",children:(0,n.jsxs)("button",{onClick:t=>O(e.id,t),style:{touchAction:"manipulation"},className:"flex flex-col items-center focus:outline-none",children:[(0,n.jsx)("div",{className:`w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 ${e.isSelected?"border-indigo-500 ring-2 ring-indigo-300 scale-110":"border-transparent"}`,children:(0,n.jsx)("img",{src:e.photo,alt:e.name,draggable:"false",className:"w-full h-full object-cover"})}),(0,n.jsx)("span",{className:`block text-xs font-medium mt-1.5 ${e.isSelected?"text-indigo-700":"text-gray-700"}`,children:e.name})]})},e.id))}):(0,n.jsx)("div",{className:"text-center py-3 text-gray-500",children:(0,n.jsx)("p",{children:"그룹에 참여한 멤버가 없습니다"})}),(0,n.jsxs)("div",{ref:D,className:"mt-2 mb-1 flex space-x-2 overflow-x-auto pb-1.5 hide-scrollbar",children:[" ",Array.from({length:15},(e,t)=>{let r=(0,m.e)(new Date,14-t),n=(0,c.GP)(r,"yyyy-MM-dd"),o=v.some(e=>e.timestamp.startsWith(n)),s=(0,c.GP)(r,"MM.dd(E)",{locale:u.ko});return 14===t?s=`오늘(${(0,c.GP)(r,"E",{locale:u.ko})})`:13===t&&(s=`어제(${(0,c.GP)(r,"E",{locale:u.ko})})`),{value:n,display:s,hasLogs:o}}).map((e,t)=>{let o="px-2.5 py-1 rounded-lg flex-shrink-0 focus:outline-none transition-colors text-xs min-w-[75px] h-8 flex flex-col justify-center items-center ",s=r===e.value;return s?(o+="bg-gray-900 text-white font-semibold shadow-md",e.hasLogs||(o+=" line-through cursor-not-allowed")):e.hasLogs?o+="bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium":o+="bg-gray-100 text-gray-400 line-through cursor-not-allowed font-medium",(0,n.jsx)("button",{onClick:()=>e.hasLogs&&F(e.value),disabled:!e.hasLogs&&!s,className:o||"",children:(0,n.jsx)("div",{className:"text-center text-xs whitespace-nowrap",children:e.display})},t)})]})]})}),(0,n.jsx)("div",{className:"w-full flex-shrink-0 snap-start overflow-hidden bg-white",children:(0,n.jsx)("div",{className:"content-section summary-section min-h-[220px] max-h-[220px] overflow-y-auto flex flex-col",children:(0,n.jsxs)("div",{children:[(0,n.jsx)("h2",{className:"text-lg font-medium text-gray-900 flex justify-between items-center section-title mb-2",children:e.find(e=>e.isSelected)?.name?`${e.find(e=>e.isSelected)?.name}의 위치기록 요약`:"위치기록 요약"}),(0,n.jsxs)("div",{className:"mb-2 px-1 flex items-center",children:[(0,n.jsx)(h.yb2,{className:"w-6 h-6 text-amber-500 mr-2"}),(0,n.jsx)("h4",{className:"text-sm font-medium text-gray-700",children:"경로 따라가기"})]}),(0,n.jsx)("div",{className:"px-2 pt-2 mb-6",children:(0,n.jsxs)("div",{className:"relative w-full h-1.5 bg-gray-200 rounded-full",children:[(0,n.jsx)("div",{style:{width:`${L}%`},className:"absolute top-0 left-0 h-1.5 bg-indigo-600 rounded-full transition-all duration-300 ease-out"}),(0,n.jsx)("div",{style:{left:`calc(${L}% - 8px)`},className:"absolute top-1/2 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white shadow transform -translate-y-1/2 transition-all duration-300 ease-out"})]})}),(0,n.jsxs)("div",{className:"flex justify-around text-center px-1",children:[(0,n.jsxs)("div",{className:"flex flex-col items-center",children:[(0,n.jsx)(h.ARf,{className:"w-6 h-6 text-amber-500 mb-1"}),(0,n.jsx)("p",{className:"text-xs text-gray-500",children:"이동거리"}),(0,n.jsx)("p",{className:"text-sm font-semibold text-gray-700 mt-0.5",children:z.distance})]}),(0,n.jsxs)("div",{className:"flex flex-col items-center",children:[(0,n.jsx)(h.Ohp,{className:"w-6 h-6 text-amber-500 mb-1"}),(0,n.jsx)("p",{className:"text-xs text-gray-500",children:"이동시간"}),(0,n.jsx)("p",{className:"text-sm font-semibold text-gray-700 mt-0.5",children:z.time})]}),(0,n.jsxs)("div",{className:"flex flex-col items-center",children:[(0,n.jsx)(h.FrA,{className:"w-6 h-6 text-amber-500 mb-1"}),(0,n.jsx)("p",{className:"text-xs text-gray-500",children:"걸음 수"}),(0,n.jsx)("p",{className:"text-sm font-semibold text-gray-700 mt-0.5",children:z.steps})]})]})]})})})]}),(0,n.jsxs)("div",{className:"flex justify-center items-center pb-2",children:[(0,n.jsx)("button",{onClick:()=>R("members"),"aria-label":"멤버 뷰로 전환",className:`w-2.5 h-2.5 rounded-full mx-1.5 focus:outline-none ${"members"===$?"bg-indigo-600 scale-110":"bg-gray-300"} transition-all duration-300`}),(0,n.jsx)("button",{onClick:()=>R("summary"),"aria-label":"요약 뷰로 전환",className:`w-2.5 h-2.5 rounded-full mx-1.5 focus:outline-none ${"summary"===$?"bg-indigo-600 scale-110":"bg-gray-300"} transition-all duration-300`})]})]})]})]})]})}},33873:e=>{"use strict";e.exports=require("path")},36335:(e,t,r)=>{Promise.resolve().then(r.bind(r,66431))},46668:(e,t,r)=>{Promise.resolve().then(r.bind(r,81076))},53201:(e,t,r)=>{"use strict";r.d(t,{e:()=>o});var n=r(20192);function o(e,t,r){return(0,n.f)(e,-t,r)}},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},66431:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>n});let n=(0,r(12907).registerClientReference)(function(){throw Error("Attempted to call the default export of \"/app/src/app/logs/layout.tsx\" from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"/app/src/app/logs/layout.tsx","default")},81076:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>s,dynamic:()=>o});var n=r(12907);let o=(0,n.registerClientReference)(function(){throw Error("Attempted to call dynamic() from the server but dynamic is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"/app/src/app/logs/page.tsx","dynamic"),s=(0,n.registerClientReference)(function(){throw Error("Attempted to call the default export of \"/app/src/app/logs/page.tsx\" from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"/app/src/app/logs/page.tsx","default")}};var t=require("../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[447,929,19,893,5,111],()=>r(8607));module.exports=n})();