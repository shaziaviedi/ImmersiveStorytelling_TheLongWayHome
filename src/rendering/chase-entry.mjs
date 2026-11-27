export const CHASE_ENTRY={start:40.4,end:51.2};
export function blendChaseEntry(market,chase,x){
 const k=Math.max(0,Math.min(1,(x-CHASE_ENTRY.start)/(CHASE_ENTRY.end-CHASE_ENTRY.start))),t=k*k*(3-2*k),result={...chase,marketBlend:t};
 for(const key of Object.keys(market)){const a=market[key],b=chase[key];if(typeof a==='number'&&typeof b==='number')result[key]=a+(b-a)*t;else if(a?.isColor&&b?.isColor)result[key]=a.clone().lerp(b,t);}
 return result;
}
