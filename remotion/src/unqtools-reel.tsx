import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
const scenes = [
 {start:0,end:300,tag:'TOO MANY TABS. TOO MUCH FRICTION.',title:'Stop searching.\nStart doing.',sub:'Your everyday tools. One focused workspace.',kind:0},
 {start:300,end:660,tag:'INTRODUCING UNQTOOLS',title:'218 free tools.\nOne destination.',sub:'Built for creators, developers and everyday work.',kind:1},
 {start:660,end:1050,tag:'YOUR WORKFLOW, UPGRADED',title:'Small tasks.\nBig momentum.',sub:'PDF · Convert · Text · SEO · Developer · Calculators',kind:2},
 {start:1050,end:1410,tag:'PRIVACY IS THE DEFAULT',title:'No accounts.\nNo tracking.',sub:'Browser-based tools. Your files stay with you.',kind:3},
 {start:1410,end:1800,tag:'MAKE YOUR NEXT CLICK COUNT',title:'Less searching.\nMore doing.',sub:'unqtools.pages.dev',kind:4}
];
const tools = ['PDF TOOLS','FILE CONVERT','SEO CHECKER','TEXT & CODE','CALCULATORS','IMAGE TOOLS'];
export const UnQToolsReel: React.FC = () => {
 const f=useCurrentFrame(); const {fps}=useVideoConfig();
 const s=scenes.find(x=>f>=x.start&&f<x.end)||scenes[4]; const local=f-s.start;
 const entrance=spring({frame:local,fps,config:{damping:18,stiffness:75}});
 const fade=interpolate(f,[s.end-16,s.end],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const cards=tools.map((t,i)=><div key={t} style={{padding:'25px 12px',borderRadius:22,background:'linear-gradient(145deg,rgba(139,92,246,.25),rgba(255,255,255,.035))',border:'1px solid rgba(139,92,246,.4)',fontSize:20,fontWeight:750,textAlign:'center',color:'#F5F1FF',opacity:interpolate(f,[s.start+20+i*7,s.start+42+i*7],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),transform:'translateY('+interpolate(f,[s.start+20+i*7,s.start+42+i*7],[32,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})+'px)'}}><div style={{fontSize:38,color:'#39E6D0',marginBottom:12}}>{['▤','⇄','⌕','{ }','＋','◈'][i]}</div>{t}</div>);
 return <AbsoluteFill style={{background:'#080910',color:'white',fontFamily:'Inter,Arial,sans-serif',overflow:'hidden'}}>
  <AbsoluteFill style={{opacity:.5,backgroundImage:'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)',backgroundSize:'64px 64px',transform:'translateY('+(-(f%64))+'px)'}}/>
  <div style={{position:'absolute',width:700,height:700,borderRadius:'50%',left:-250,top:160+Math.sin(f/30)*40,background:'radial-gradient(circle,rgba(139,92,246,.3),transparent 70%)'}}/>
  <div style={{position:'absolute',width:650,height:650,borderRadius:'50%',right:-300,bottom:150,background:'radial-gradient(circle,rgba(57,230,208,.18),transparent 70%)'}}/>
  <div style={{position:'absolute',top:72,left:64,right:64,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:14}}><div style={{width:48,height:48,borderRadius:15,background:'linear-gradient(135deg,#A78BFA,#6D28D9)',display:'grid',placeItems:'center',fontSize:28,fontWeight:900}}>U</div><b style={{fontSize:28}}>UnQTools</b></div><span style={{fontSize:15,letterSpacing:3,color:'#B9B6D0'}}>ZERO FRICTION</span></div>
  <div style={{position:'absolute',top:265,left:64,right:64,bottom:210,display:'flex',flexDirection:'column',justifyContent:'center',opacity:fade,transform:'translateY('+interpolate(entrance,[0,1],[45,0])+'px)'}}>
   <div style={{fontSize:17,fontWeight:800,letterSpacing:4,color:'#39E6D0',marginBottom:30}}>{s.tag}</div>
   <div style={{fontSize:s.kind===1?82:78,lineHeight:1.04,fontWeight:850,letterSpacing:-3,whiteSpace:'pre-line',background:'linear-gradient(100deg,#FFFFFF 10%,#D8CCFF 56%,#7DEFE0 100%)',WebkitBackgroundClip:'text',color:'transparent'}}>{s.title}</div>
   <div style={{fontSize:27,lineHeight:1.45,color:'#C4C2D7',marginTop:28}}>{s.sub}</div>
   {s.kind===0&&<div style={{marginTop:65,padding:28,borderRadius:30,background:'linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.025))',border:'1px solid rgba(255,255,255,.15)',transform:'rotate(-2deg)'}}><div style={{display:'flex',gap:10,marginBottom:24}}>{['#FF6B6B','#FFC857','#5EEAD4'].map(c=><div key={c} style={{width:12,height:12,borderRadius:12,background:c}}/>)}</div><div style={{display:'flex',flexWrap:'wrap',gap:12}}>{['PDF converter','Image resizer','JSON formatter','SEO checker','Word counter'].map(x=><span key={x} style={{padding:'13px 16px',borderRadius:12,background:'rgba(255,255,255,.07)',fontSize:18,color:'#DAD8E9'}}>{x}</span>)}</div></div>}
   {s.kind===1&&<div style={{marginTop:55,padding:25,borderRadius:30,background:'linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,.02))',border:'1px solid rgba(255,255,255,.15)'}}><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>{tools.map((t,i)=><div key={t} style={{padding:20,borderRadius:18,background:'rgba(139,92,246,.14)',fontSize:17,color:'#E9E4FF'}}><div style={{fontSize:30,color:'#39E6D0',marginBottom:10}}>{['▤','⇄','⌕','¶','{ }','＋'][i]}</div>{t}</div>)}</div><div style={{marginTop:22,fontSize:25,fontWeight:850,color:'#39E6D0'}}>218 TOOLS. ZERO CLUTTER.</div></div>}
   {s.kind===2&&<div style={{marginTop:55,display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>{cards}</div>}
   {s.kind===3&&<div style={{marginTop:55,display:'grid',gap:16}}>{['◈   Browser-based tools','✓   No account required','⌁   No tracking'].map(t=><div key={t} style={{padding:27,borderRadius:22,background:'linear-gradient(145deg,rgba(255,255,255,.1),rgba(255,255,255,.02))',border:'1px solid rgba(255,255,255,.14)',fontSize:25,fontWeight:750}}>{t}</div>)}</div>}
   {s.kind===4&&<div style={{marginTop:60,display:'inline-block',padding:'20px 26px',border:'1px solid rgba(57,230,208,.5)',borderRadius:18,background:'rgba(57,230,208,.08)',fontSize:28,fontWeight:850,color:'#39E6D0',width:'fit-content'}}>OPEN UNQTOOLS ↗</div>}
  </div>
  <div style={{position:'absolute',bottom:70,left:64,right:64}}><div style={{height:3,background:'rgba(255,255,255,.12)',borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:(f/1799*100)+'%',background:'linear-gradient(90deg,#8B5CF6,#39E6D0)'}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:18,fontSize:15,letterSpacing:2,color:'#77758E'}}><span>TOOLS THAT RESPECT YOUR TIME</span><span>UNQTOOLS ©</span></div></div>
 </AbsoluteFill>;
};
