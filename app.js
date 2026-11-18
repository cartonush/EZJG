const DEMO_PATH = 'data/sample-data.csv';
const APP_VERSION = '1.0.9';
const EXPECTED = ['מכלול', 'מערכת', 'פאנל', 'כרך', 'JG', 'מסחא'];
let records = [];
let mode = 'panel';
let activeChoice = '';
let activeQuery = '';
let selectedRecord = null;
let installPrompt = null;

const $ = (id) => document.getElementById(id);
if ($('appVersion')) $('appVersion').textContent = APP_VERSION;
document.addEventListener('gesturestart', event => event.preventDefault(), {passive:false});
document.addEventListener('gesturechange', event => event.preventDefault(), {passive:false});
document.addEventListener('touchmove', event => {if(event.touches.length>1)event.preventDefault();}, {passive:false});
const normalize = (value) => String(value ?? '').trim();
const unique = (key) => [...new Set(records.map(row => normalize(row[key])).filter(Boolean))]
  .sort((a,b) => a.localeCompare(b, 'he', {numeric:true}));
const modeLabel = (value) => value === 'panel' ? 'פאנל' : 'מערכת';
const otherMode = () => mode === 'panel' ? 'system' : 'panel';
const esc = (value) => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function parseCsv(text) {
  const rows=[]; let row=[], value='', quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"' && quoted && text[i+1]==='"'){value+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===',' && !quoted){row.push(value);value='';continue;}
    if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(cell=>cell.trim()))rows.push(row);row=[];value='';continue;}
    value+=ch;
  }
  row.push(value); if(row.some(cell=>cell.trim()))rows.push(row);
  if(rows.length<2)return [];
  const headers=rows.shift().map(h=>h.replace(/^\uFEFF/,'').trim());
  return rows.map(cells=>Object.fromEntries(headers.map((header,index)=>[header,normalize(cells[index])])));
}

function validateRows(rows) {
  if(!Array.isArray(rows) || !rows.length) throw new Error('הקובץ לא מכיל שורות נתונים.');
  const headers=Object.keys(rows[0]).map(key=>key.trim());
  const missing=EXPECTED.filter(key=>!headers.includes(key));
  if(missing.length) throw new Error(`חסרות עמודות חובה: ${missing.join(', ')}.`);
  const cleaned=rows.map(row=>Object.fromEntries(EXPECTED.map(key=>[key,normalize(row[key])]))).filter(row=>row['מכלול']||row['מערכת']||row['פאנל']);
  if(!cleaned.length) throw new Error('לא נמצאו שורות מלאות בקובץ.');
  return cleaned;
}

function updateStatus() {
  $('dataStatus').textContent=`נתוני הדגמה נטענו · ${records.length} שורות`;
}

async function loadDefault() {
  let loaded=false;
  if(window.XLSX){
    try{
      const response=await fetch('data/טבלת_מכלולים_לדוגמה.xlsx');if(!response.ok)throw new Error();
      const workbook=XLSX.read(await response.arrayBuffer(),{type:'array'});
      records=validateRows(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:'',raw:false}));loaded=true;
    }catch{}
  }
  if(!loaded){try{const response=await fetch(DEMO_PATH);if(!response.ok)throw new Error();records=validateRows(parseCsv(await response.text()));}catch{records=validateRows(DEMO_FALLBACK);}}
  updateStatus(false);
}

const DEMO_FALLBACK=[
  {'מכלול':'PSP','מערכת':'מכם | FCR - 74A','פאנל':'פאנל 1202','כרך':'0235','JG':'JG-3','מסחא':'3'},
  {'מכלול':'DMT','מערכת':'מכם | FCR - 74A','פאנל':'פאנל 1101','כרך':'0235','JG':'JG-2','מסחא':'2'},
  {'מכלול':'MLPRF','מערכת':'מכם | FCR - 74A','פאנל':'פאנל 1202','כרך':'0235','JG':'JG-4','מסחא':'4'},
  {'מכלול':'ANT','מערכת':'מכם | FCR - 74A','פאנל':'פאנל 1100','כרך':'0235','JG':'JG-1','מסחא':'1'}
];

function setNav(active) {
  document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.id===active));
}
function goHome() {
  $('homeView').hidden=false;$('browseView').hidden=true;$('resultsView').hidden=true;
  setNav('navHome');activeChoice='';activeQuery='';
}
function openBrowse(nextMode) {
  mode=nextMode;activeChoice='';activeQuery='';
  $('homeView').hidden=true;$('browseView').hidden=false;$('resultsView').hidden=true;
  $('menuPanels').classList.toggle('active',mode==='panel');$('menuPanels').setAttribute('aria-pressed',String(mode==='panel'));
  $('menuSystems').classList.toggle('active',mode==='system');$('menuSystems').setAttribute('aria-pressed',String(mode==='system'));
  $('modeCrumb').textContent=`לפי ${modeLabel(mode)}`;
  $('browseEyebrow').textContent=`שלב 1 · ${modeLabel(mode)}ים בטבלה`;
  $('browseTitle').textContent=`בחר ${modeLabel(mode)}`;
  $('choiceSearch').placeholder=`חיפוש ${modeLabel(mode)}…`;$('choiceSearch').value='';$('clearSearch').hidden=true;
  setNav(mode==='panel'?'navPanels':'navSystems');renderChoices();
}
function renderChoices() {
  const key=mode==='panel'?'פאנל':'מערכת';
  const list=unique(key).filter(value=>value.toLocaleLowerCase('he').includes(activeQuery.toLocaleLowerCase('he')));
  $('choiceCount').textContent=`${list.length} אפשרויות`;
  $('choiceList').innerHTML=list.length?list.map(value=>{
    const count=records.filter(row=>row[key]===value).length;
    const direction=key==='מערכת'?'rtl':'auto';
    return `<button class="choice-card" data-choice="${esc(value)}"><span><bdi dir="${direction}"><b>${esc(value)}</b></bdi><br><small>${count} מכלולים</small></span><span class="choice-arrow">←</span></button>`;
  }).join(''):'<div class="empty-state">לא נמצאו תוצאות לחיפוש הזה.</div>';
  $('choiceList').querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>openResults(button.dataset.choice)));
}
function openResults(value) {
  activeChoice=value;$('browseView').hidden=true;$('resultsView').hidden=false;
  const key=mode==='panel'?'פאנל':'מערכת';
  const list=records.filter(row=>row[key]===value).sort((a,b)=>a['מכלול'].localeCompare(b['מכלול'],'he'));
  $('selectedCrumb').textContent=value;
  $('resultsEyebrow').textContent=`שלב 2 · מכלולים ב${modeLabel(mode)} הנבחר`;
  $('resultsTitle').textContent=value;
  $('resultCount').textContent=`${list.length} מכלולים`;
  $('resultList').innerHTML=list.length?list.map((row,index)=>`<button class="result-card" data-index="${index}"><span class="result-index">${String(index+1).padStart(2,'0')}</span><span class="result-info"><bdi dir="auto"><b>${esc(row['מכלול'])}</b></bdi><small><bdi dir="rtl">${esc(row['מערכת'])}</bdi> · <bdi dir="auto">${esc(row['פאנל'])}</bdi></small></span><span class="result-chevron">←</span></button>`).join(''):'<div class="empty-state">אין מכלולים המשויכים לבחירה הזו.</div>';
  $('resultList').querySelectorAll('[data-index]').forEach(button=>button.addEventListener('click',()=>showDetails(list[Number(button.dataset.index)])));
}
function showDetails(row) {
  selectedRecord=row;
  $('detailName').textContent=row['מכלול'];
  $('detailMeta').innerHTML=`<button type="button" class="meta-box meta-action" id="systemMetaButton"><small>מערכת · פתיחת דף</small><bdi dir="rtl"><b>${esc(row['מערכת']||'—')}</b></bdi></button><button type="button" class="meta-box meta-action" id="panelMetaButton"><small>פאנל · פתיחת דף</small><bdi dir="auto"><b>${esc(row['פאנל']||'—')}</b></bdi></button><div class="meta-box"><small>כרך</small><b>${esc(row['כרך']||'—')}</b></div><div class="meta-box"><small>JG</small><bdi dir="auto"><b>${esc(row['JG']||'—')}</b></bdi></div><div class="meta-box"><small>מסחא</small><b>${esc(row['מסחא']||'—')}</b></div>`;
  const target=mode==='panel'?'מערכת':'פאנל';
  $('alternateView').innerHTML=`מעבר לתצוגת ${target} <span>←</span>`;
  $('systemMetaButton').addEventListener('click',()=>openRelatedView('system',row['מערכת']));
  $('panelMetaButton').addEventListener('click',()=>openRelatedView('panel',row['פאנל']));
  $('detailDialog').showModal();
}
function activateAlternate() {
  if(!selectedRecord)return;
  const target=mode==='panel'?'system':'panel';const value=target==='system'?selectedRecord['מערכת']:selectedRecord['פאנל'];
  openRelatedView(target,value);
}
function openRelatedView(target,value) {
  $('detailDialog').close();openBrowse(target);openResults(value);
}

$('homeButton').addEventListener('click',goHome);
$('backHome').addEventListener('click',goHome);
$('backChoices').addEventListener('click',()=>{ $('resultsView').hidden=true;$('browseView').hidden=false; });
document.querySelectorAll('.mode-card').forEach(button=>button.addEventListener('click',()=>openBrowse(button.dataset.mode)));
$('choiceSearch').addEventListener('input',event=>{activeQuery=event.target.value;$('clearSearch').hidden=!activeQuery;renderChoices();});
$('clearSearch').addEventListener('click',()=>{$('choiceSearch').value='';$('choiceSearch').dispatchEvent(new Event('input'));});
$('navHome').addEventListener('click',goHome);
$('navPanels').addEventListener('click',()=>openBrowse('panel'));
$('navSystems').addEventListener('click',()=>openBrowse('system'));
$('menuPanels').addEventListener('click',()=>openBrowse('panel'));
$('menuSystems').addEventListener('click',()=>openBrowse('system'));
$('closeDialog').addEventListener('click',()=>$('detailDialog').close());
$('alternateView').addEventListener('click',activateAlternate);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('installButton').hidden=false;});
$('installButton').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installButton').hidden=true;});
loadDefault().then(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{});});
