const fs=require('node:fs'),path=require('node:path');
const {safeName}=require('./media.cjs');
const key=value=>String(value).toLowerCase();
function occupied(folder,jobs=[]){
  const used=new Set();
  for(const name of fs.readdirSync(folder))if(/\.(mp4|mp3)$/i.test(name))used.add(key(path.parse(name).name));
  for(const job of jobs)if(path.resolve(job.outputDir||folder).toLowerCase()===path.resolve(folder).toLowerCase()&&job.outputStem&&['queued','preparing','searching','downloading','speech','analysing','rendering','saving'].includes(job.status))used.add(key(job.outputStem));
  return used;
}
function allocate(name,used){const base=safeName(name);let stem=base,index=2;while(used.has(key(stem))){stem=base+' ('+index+')';index++;}used.add(key(stem));return stem;}
function planOutputs(songs,settings,folder,jobs=[]){
  const used=occupied(folder,jobs),multiple=songs.length>1;
  return songs.map(song=>{const title=song.title||'YouTube videosu',name=settings.outputName?(multiple?settings.outputName+' - '+title:settings.outputName):title+' - Jenerik',stem=allocate(name,used);return {title,stem,mp4:path.join(folder,stem+'.mp4'),mp3:settings.alsoMp3?path.join(folder,stem+'.mp3'):null};});
}
module.exports={occupied,allocate,planOutputs};
