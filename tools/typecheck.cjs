const {spawnSync}=require('node:child_process');
const path=require('node:path');
let compiler;
try{compiler=require.resolve('typescript/bin/tsc');}
catch{compiler=path.join(process.env.COCOS_CREATOR_HOME||'D:/Softwares/CocosDashboard/resources/editors/Creator/3.8.8','resources/app.asar.unpacked/node_modules/typescript/bin/tsc');}
const result=spawnSync(process.execPath,[compiler,'--noEmit','--pretty','false','-p',path.resolve(__dirname,'../tsconfig.json')],{stdio:'inherit'});
if(result.error){console.error(result.error.message);process.exit(1);}process.exit(result.status??1);
