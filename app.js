const DEMO_PATH = 'data/sample-data.csv';
const EXPECTED = ['מכלול', 'מערכת', 'פאנל', 'כרך', 'JG'];
let records = [];
let mode = 'panel';
let activeChoice = '';
let activeQuery = '';
let selectedRecord = null;
let installPrompt = null;

const $ = (id) => document.getElementById(id);
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

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast=document.createElement('div');toast.className='toast';toast.textContent=message;document.body.append(toast);
  setTimeout(()=>toast.remove(),3200);
}

function updateStatus(isCustom=false) {
  $('dataStatus').textContent=isCustom?`נטענה טבלה אישית · ${records.length} שורות`:`נתוני הדגמה נטענו · ${records.length} שורות`;
  $('resetData').hidden=!isCustom;
}

async function loadDefault() {
  const stored=localStorage.getItem('ezjg-records');
  if(stored){try{records=validateRows(JSON.parse(stored));updateStatus(true);return;}catch{localStorage.removeItem('ezjg-records');}}
  try{const response=await fetch(DEMO_PATH);if(!response.ok)throw new Error();records=validateRows(parseCsv(await response.text()));}
  catch{records=validateRows(DEMO_FALLBACK);}
  updateStatus(false);
}

const DEMO_FALLBACK=[
  {'מכלול':'מחשב ראשי','מערכת':'בקרה כללית','פאנל':'פאנל 3','כרך':'כרך 1','JG':'JG 01'},
  {'מכלול':'יחידת תצוגה','מערכת':'בקרה כללית','פאנל':'פאנל 3','כרך':'כרך 1','JG':'JG 02'},
  {'מכלול':'כרטיס ממשק','מערכת':'בקרה כללית','פאנל':'פאנל 5','כרך':'כרך 2','JG':'JG 11'},
  {'מכלול':'יחידת הזנה','מערכת':'חשמל משני','פאנל':'פאנל 3','כרך':'כרך 3','JG':'JG 04'},
  {'מכלול':'ממיר מתח','מערכת':'חשמל משני','פאנל':'פאנל 7','כרך':'כרך 3','JG':'JG 07'},
  {'מכלול':'חיישן מדומה','מערכת':'חישה והתרעה','פאנל':'פאנל 5','כרך':'כרך 2','JG':'JG 12'},
  {'מכלול':'בקר עזר','מערכת':'חישה והתרעה','פאנל':'פאנל 9','כרך':'כרך 4','JG':'JG 20'},
  {'מכלול':'מכלול תקשורת','מערכת':'תקשורת פנימית','פאנל':'פאנל 7','כרך':'כרך 5','JG':'JG 08'},
  {'מכלול':'מתאם נתונים','מערכת':'תקשורת פנימית','פאנל':'פאנל 9','כרך':'כרך 5','JG':'JG 21'}
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
    return `<button class="choice-card" data-choice="${esc(value)}"><span><b>${esc(value)}</b><br><small>${count} מכלולים</small></span><span class="choice-arrow">←</span></button>`;
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
  $('resultList').innerHTML=list.length?list.map((row,index)=>`<button class="result-card" data-index="${index}"><span class="result-index">${String(index+1).padStart(2,'0')}</span><span class="result-info"><b>${esc(row['מכלול'])}</b><small>${esc(row['מערכת'])} · ${esc(row['פאנל'])}</small></span><span class="result-chevron">←</span></button>`).join(''):'<div class="empty-state">אין מכלולים המשויכים לבחירה הזו.</div>';
  $('resultList').querySelectorAll('[data-index]').forEach(button=>button.addEventListener('click',()=>showDetails(list[Number(button.dataset.index)])));
}
function showDetails(row) {
  selectedRecord=row;
  $('detailName').textContent=row['מכלול'];
  $('detailMeta').innerHTML=`<div class="meta-box"><small>מערכת</small><b>${esc(row['מערכת']||'—')}</b></div><div class="meta-box"><small>פאנל</small><b>${esc(row['פאנל']||'—')}</b></div><div class="meta-box"><small>כרך</small><b>${esc(row['כרך']||'—')}</b></div><div class="meta-box"><small>JG</small><b>${esc(row['JG']||'—')}</b></div>`;
  const target=mode==='panel'?'מערכת':'פאנל';
  $('alternateView').innerHTML=`מעבר לתצוגת ${target} <span>←</span>`;
  $('detailDialog').showModal();
}
function activateAlternate() {
  if(!selectedRecord)return;
  const target=mode==='panel'?'system':'panel';const value=target==='system'?selectedRecord['מערכת']:selectedRecord['פאנל'];
  $('detailDialog').close();openBrowse(target);$('choiceSearch').value=value;$('choiceSearch').dispatchEvent(new Event('input'));
  if(unique(target==='panel'?'פאנל':'מערכת').includes(value))openResults(value);
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
$('navData').addEventListener('click',()=>$('excelFile').click());
$('closeDialog').addEventListener('click',()=>$('detailDialog').close());
$('alternateView').addEventListener('click',activateAlternate);
$('resetData').addEventListener('click',()=>{localStorage.removeItem('ezjg-records');loadDefault().then(()=>{goHome();showToast('נתוני ההדגמה נטענו מחדש.');});});
$('excelFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    let rows;
    if(file.name.toLowerCase().endsWith('.csv'))rows=parseCsv(await file.text());
    else {
      if(!window.XLSX)throw new Error('טעינת Excel דורשת חיבור אינטרנט בפעם הראשונה.');
      const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
      const sheet=workbook.Sheets[workbook.SheetNames[0]];
      rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});
    }
    records=validateRows(rows);localStorage.setItem('ezjg-records',JSON.stringify(records));updateStatus(true);goHome();showToast(`נטענו ${records.length} שורות מהטבלה.`);
  }catch(error){showToast(error.message||'לא ניתן לקרוא את הקובץ.');}
  event.target.value='';
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('installButton').hidden=false;});
$('installButton').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installButton').hidden=true;});
loadDefault().then(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{});});
