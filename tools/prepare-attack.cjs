/** Extract disconnected character poses without cutting swords at nominal grid boundaries. */
const fs=require('node:fs'),path=require('node:path'),{PNG}=require('pngjs');
const crypto=require('node:crypto');
const art=path.resolve(__dirname,'../assets/resources/art');
const source=PNG.sync.read(fs.readFileSync(path.join(art,'hero-attack-source.png')));
const {width:w,height:h,data}=source, labels=new Int32Array(w*h), queue=new Int32Array(w*h), parts=[];
let nextId=0;
for(let start=0;start<w*h;start++) {
 if(labels[start]||!data[start*4+3])continue;
 const id=++nextId;let head=0,tail=1,minX=w,minY=h,maxX=0,maxY=0;queue[0]=start;labels[start]=id;
 while(head<tail) {
  const p=queue[head++],x=p%w,y=Math.floor(p/w);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
   if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;
   const n=ny*w+nx;if(!labels[n]&&data[n*4+3]){labels[n]=id;queue[tail++]=n;}
  }
 }
 if(tail>5000)parts.push({id,count:tail,minX,minY,maxX,maxY});
}
parts.sort((a,b)=>b.count-a.count);const poses=parts.slice(0,4);
if(poses.length!==4)throw new Error(`Expected four disconnected character poses, got ${poses.length}`);
poses.sort((a,b)=>Math.floor((a.minY+a.maxY)/2/(h/2))-Math.floor((b.minY+b.maxY)/2/(h/2)) || a.minX-b.minX);
const fw=840,fh=680,baseline=640,atlas=new PNG({width:fw*2,height:fh*2}),layout=[];
poses.forEach((p,i)=>{
 let sumX=0,samples=0;
 for(let y=p.maxY-24;y<=p.maxY;y++)for(let x=p.minX;x<=p.maxX;x++)if(labels[y*w+x]===p.id){sumX+=x;samples++;}
 const footX=sumX/samples,offsetX=Math.round(fw/2-footX),offsetY=baseline-p.maxY;
 if(p.minX+offsetX<0||p.maxX+offsetX>=fw||p.minY+offsetY<0)throw new Error(`Pose ${i} exceeds frame bounds`);
 for(let y=p.minY;y<=p.maxY;y++)for(let x=p.minX;x<=p.maxX;x++)if(labels[y*w+x]===p.id){
  const out=((Math.floor(i/2)*fh+y+offsetY)*atlas.width+i%2*fw+x+offsetX)*4;data.copy(atlas.data,out,(y*w+x)*4,(y*w+x)*4+4);
 }
 layout.push({name:['windup','strike','followthrough','recover'][i],sourceBounds:[p.minX,p.minY,p.maxX-p.minX+1,p.maxY-p.minY+1],frame:[i%2*fw,Math.floor(i/2)*fh,fw,fh],baseline,footX:fw/2});
});
fs.writeFileSync(path.join(art,'hero-attack.png'),PNG.sync.write(atlas));
fs.writeFileSync(path.join(art,'hero-attack-layout.json'),JSON.stringify({source:'hero-attack-source.png',output:'hero-attack.png',frameSize:[fw,fh],frames:layout},null,2));
for(const name of ['hero-attack','hero-attack-source']) {
 const metaPath=path.join(art,name+'.png.meta'); if(fs.existsSync(metaPath))continue;
 const hex=crypto.createHash('md5').update('maplewild-388/'+name).digest('hex'),id=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 fs.writeFileSync(metaPath,JSON.stringify({ver:'1.0.27',importer:'image',imported:true,uuid:id,files:['.json','.png'],subMetas:{'6c48a':{ver:'1.0.22',importer:'texture',imported:true,uuid:id+'@6c48a',displayName:name,id:'6c48a',name:'texture',files:['.json'],subMetas:{},userData:{wrapModeS:'clamp-to-edge',wrapModeT:'clamp-to-edge',minfilter:'linear',magfilter:'linear',mipfilter:'none',anisotropy:0,isUuid:true,imageUuidOrDatabaseUri:id}}},userData:{type:'texture',hasAlpha:true,fixAlphaTransparencyArtifacts:false,redirect:id+'@6c48a'}},null,2));
}
console.log(JSON.stringify({source:[w,h],frames:layout},null,2));
