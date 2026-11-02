const {contextBridge,ipcRenderer}=require('electron');
const call=(name,...args)=>ipcRenderer.invoke('kty:'+name,...args);
contextBridge.exposeInMainWorld('kutarya',{
  state:()=>call('state'),choose:kind=>call('choose',kind),save:settings=>call('save',settings),
  voices:refresh=>call('voices',refresh),speech:settings=>call('speech',settings),start:settings=>call('start',settings),
  cancel:id=>call('cancel',id),retry:id=>call('retry',id),output:id=>call('output',id),reveal:id=>call('reveal',id),
  folder:()=>call('folder'),changeFolder:()=>call('change-folder'),paste:()=>call('paste'),loadProject:()=>call('load-project'),saveProject:settings=>call('save-project',settings),
  clearCache:()=>call('clear-cache'),
  inspect:file=>call('inspect',file),search:query=>call('search',query),lookup:url=>call('lookup',url),outputPlan:raw=>call('output-plan',raw),chooseBatch:()=>call('choose-batch'),
  previewSong:url=>call('preview-song',url),cancelSongPreview:()=>call('cancel-song-preview'),
  elevenVoices:refresh=>call('eleven-voices',refresh),elevenStatus:()=>call('eleven-status'),connectEleven:raw=>call('connect-eleven',raw),disconnectEleven:()=>call('disconnect-eleven'),
  exportSpeech:raw=>call('export-speech',raw),cancelAll:()=>call('cancel-all'),reuse:id=>call('reuse',id),
  minimize:()=>ipcRenderer.send('kty:minimize'),maximize:()=>ipcRenderer.send('kty:maximize'),close:()=>ipcRenderer.send('kty:close'),
  onChange:fn=>{const listener=(_event,data)=>fn(data);ipcRenderer.on('kty:changed',listener);return()=>ipcRenderer.removeListener('kty:changed',listener);}
});
