export const INTRO_TIMING = Object.freeze({bodyFade:900,titleHold:2500,titleFade:900,titleMove:1000});
export const playerText = value => String(value ?? '').replace(/\u2014/g, ', ').replace(/ +,/g, ',').replace(/,\s*,/g, ',');

// Rich DOM copy is shared by desktop and XR; measure the complete block before drawing
// so fades never change its wrapping or push the ending outside the viewing area.
export function layoutCard(g,groups,width,height,reserve=0){
 const styles={title:{size:64,line:78,gap:22,family:'"Spectral", Georgia, serif'},stat:{size:44,line:57,gap:18,family:'"Spectral", Georgia, serif'},small:{size:24,line:34,gap:12,family:'"Gowun Batang", Georgia, serif'}};
 let scale=1,blocks,total;
 for(let attempt=0;attempt<12;attempt++){
  blocks=[];total=reserve;
  for(const group of groups){
   const style=styles[group.kind],tokens=[];
   function walk(node,strong=false,em=false){if(node.id==='pro-title'){g.font=`400 ${Math.round(style.size*scale)}px ${style.family}`;tokens.push({word:'the long way home',strong:true,em:false,hero:true});return;}for(const child of node.childNodes){if(child.nodeType===3){for(let word of playerText(child.textContent).split(/([ \t\r\n]+)/)){if(!word)continue;if(/^[ \t\r\n]+$/.test(word))word=' ';if(word===' '&&tokens.at(-1)?.word===' ')continue;tokens.push({word,strong,em});}}else if(child.nodeType===1)walk(child,strong||child.nodeName==='STRONG',em||child.nodeName==='EM');}}
   walk(group.el);const rows=[];let row=[],length=0;
   for(const token of tokens){const font=`${token.em?'italic ':''}400 ${Math.round(style.size*scale)}px ${style.family}`;g.font=font;
    const w=g.measureText(token.word).width,space=/^\s+$/.test(token.word);
    if(!space&&length+w>width-128&&row.length){while(row.length&&/^\s+$/.test(row.at(-1).word))length-=row.pop().width;rows.push({tokens:row,width:length});row=[];length=0;}
    if(space&&!row.length)continue;row.push({...token,font,width:w});length+=w;
   }
   while(row.length&&/^\s+$/.test(row.at(-1).word))length-=row.pop().width;
   if(row.length)rows.push({tokens:row,width:length});
   const line=style.line*scale,h=rows.length*line;
   blocks.push({...group,rows,line,height:h,gap:style.gap*scale});total+=h+style.gap*scale;
  }
  if(total<=height-96)break;scale*=.92;
 }
 let y=(height-total)/2;for(const block of blocks){block.y=y;y+=block.height+block.gap;}
 return {blocks,total,scale,bottom:y};
}
