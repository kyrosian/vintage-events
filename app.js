import {CONFIG} from './config.js';
import {parseCSV,buildEvents,phase,attendanceLabel,normalise,key,escapeHtml as esc} from './events.js';
const $=id=>document.getElementById(id);
const fmt=value=>value===null||value===undefined?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
const initials=name=>normalise(name).split(/\s+/).map(n=>n[0]).join('').slice(0,2).toUpperCase()||'—';
const avatar=name=>`<span class="avatar" aria-hidden="true">${esc(initials(name))}</span>`;
const views=['overview','standings','winners','leaderboard','history'];
const titles={overview:'Events',standings:'Standings',winners:'Winners',leaderboard:'Leaderboard',history:'Past events'};
const state={model:{events:[],leaderboards:{players:[],teams:[]}},eventId:'',competitor:'',view:'overview',board:'players',loadedAt:null,source:'loading',loading:false,error:'',profile:null};
const selectedEvent=()=>state.model.events.find(e=>e.id===state.eventId)??null;
const preference='vintage-events:selected-event';
const emptyEvent=()=>({id:'',name:'No events yet',format:'Individual',duration:90,status:'draft',start:null,end:null,scoreLabel:'Points',scoreOrder:'Highest',entries:[],competitors:[],winners:[],winnerState:'unconfirmed',warnings:[],rules:'Add your first event in the Events sheet.',prize:'',prizeDetails:'',attendance:{confirmed:0,unknown:0,absent:0}});
function notify(message,error=false){$('notice').textContent=message;$('notice').hidden=!message;$('notice').classList.toggle('error',error);}
function dateTime(time){return time===null?'To be scheduled':new Date(time).toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
function dateOnly(time){return time===null?'Date not recorded':new Date(time).toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'});}
function selectDefault(){
  if(state.model.events.some(e=>e.id===state.eventId))return;
  let saved='';try{saved=localStorage.getItem(preference)||'';}catch{}
  const requested=new URLSearchParams(location.search).get('event');
  state.eventId=(state.model.events.find(e=>e.id===requested)??state.model.events.find(e=>e.id===saved)??state.model.events.find(e=>!['completed','cancelled'].includes(e.status))??state.model.events[0])?.id??'';
}
function accept(model,loadedAt,source){state.model=model;state.loadedAt=loadedAt;state.source=source;state.error='';selectDefault();render();}
function currentCompetitor(event){return event.competitors.find(c=>key(c.name)===key(state.competitor))??event.competitors[0]??null;}
function winnerHTML(event){
  if(event.status==='cancelled')return'<strong>No winner</strong><p>This event was cancelled.</p>';
  if(event.winnerState!=='confirmed')return`<strong>${event.status==='completed'?'Result awaiting confirmation':'Not announced yet'}</strong><p>${event.status==='completed'?'The organiser is confirming the final result.':'Winners are confirmed after the event.'}</p>`;
  return`<div class="winner-names">${event.winners.map(w=>`<div class="winner-name">${avatar(w.name)}<span>${esc(w.name)}</span></div>`).join('')}</div><p>${event.winners[0]?.score!==null?`${fmt(event.winners[0]?.score)} ${esc(event.scoreLabel.toLowerCase())} · `:''}${event.manualWinner?'Confirmed by the organiser':event.winners.length>1?'Shared event win':'Event winner'}</p>`;
}
function prizesHTML(event){return event.prize?`<div class="prize-section"><span class="eyebrow">PRIZE POOL</span><strong>${esc(event.prize)}</strong>${event.prizeDetails?`<p>${esc(event.prizeDetails)}</p>`:''}</div>`:'';}
function standingsTable(event,competitors){
  if(!competitors.length)return`<div class="empty-state"><strong>${event.competitors.length?'No matching competitors':'The lineup is open'}</strong>${event.competitors.length?'Try another name.':'Participants will appear once they are added to this event.'}</div>`;
  return`<div class="table-wrap"><table><caption class="sr-only">${esc(event.name)} standings. Equal scores share a rank; blank scores are unranked.</caption><thead><tr><th scope="col">RANK</th><th scope="col">${event.format==='Teams'?'TEAM':'PLAYER'}</th>${event.format==='Teams'?'<th scope="col" class="numeric hide-small">MEMBERS</th>':''}<th scope="col" class="numeric">${esc(event.scoreLabel.toUpperCase())}</th></tr></thead><tbody>${competitors.map(c=>`<tr class="${key(c.name)===key(state.competitor)?'selected-row':''}"><td class="rank-cell">${c.rank===null?'—':String(c.rank).padStart(2,'0')}</td><td><button class="table-name" data-competitor="${esc(c.name)}">${avatar(c.name)}<span>${esc(c.name)}</span></button></td>${event.format==='Teams'?`<td class="numeric muted hide-small">${c.members.length}</td>`:''}<td class="numeric score-cell">${fmt(c.score)}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderStandings(){
  const event=selectedEvent()??emptyEvent();
  $('overview-standings').innerHTML=standingsTable(event,event.competitors.slice(0,5));
  $('all-standings').innerHTML=standingsTable(event,event.competitors.filter(c=>key(c.name).includes(key($('competitor-search').value))));
  $('standings-title').textContent=`${event.format==='Teams'?'Teams':'Players'} · ${event.competitors.length}`;
  $('standings-description').textContent=`${event.name} · ${event.scoreOrder} score wins`;
  $('standings-note').textContent=event.warnings.join(' ')||'Equal scores share a position. A dash means a score has not been recorded.';
}
function renderClock(){
  const event=selectedEvent()??emptyEvent(),clock=phase(event);
  const statusLabel=event.id?clock.label:'No event';if($('event-status').textContent!==statusLabel)$('event-status').textContent=statusLabel;$('event-status').className=`status-tag ${clock.kind}`;
  $('clock-status').textContent=event.id?clock.label:'No event';$('clock-caption').textContent=clock.caption;
  let time='— : —';
  if(clock.time!==null){const total=Math.max(0,Math.ceil(clock.time/1000)),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;time=`${days?days+'d ':''}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;}
  if(clock.kind==='completed')time='Finished';if(clock.kind==='cancelled')time='Cancelled';
  $('countdown').textContent=time;$('time-progress').style.width=`${clock.progress}%`;
}
function renderOverview(){
  const event=selectedEvent()??emptyEvent();const competitor=currentCompetitor(event);state.competitor=competitor?.name??'';
  $('event-title').textContent=event.name;$('event-description').textContent=event.id?`${event.format==='Teams'?'Team':'Individual'} competition · Vintage clan events`:'The next clan event starts here.';
  $('format-label').textContent=event.format;$('duration-label').innerHTML=`${fmt(event.duration)} <span>min</span>`;
  $('participant-count').textContent=event.entries.length;$('scoring-label').textContent=event.scoreLabel;
  $('start-label').textContent=dateTime(event.start);$('end-label').textContent=dateTime(event.end);
  $('timezone-note').textContent=`Times shown in ${Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_',' ')}.`;
  $('winner-heading').textContent=event.winners.length>1?'Joint winners':'Winner';$('winner-content').innerHTML=winnerHTML(event);
  $('prize-section').hidden=!event.prize;$('prize-value').textContent=event.prize;$('prize-details').textContent=event.prizeDetails;$('prize-details').hidden=!event.prizeDetails;
  $('lineup-eyebrow').textContent=event.format==='Teams'?'TEAM LINEUP':'COMPETITOR SPOTLIGHT';$('lineup-title').textContent=competitor?.name??'Participants to be announced';
  $('competitor-select').innerHTML=event.competitors.length?event.competitors.map(c=>`<option value="${esc(c.name)}" ${c.name===state.competitor?'selected':''}>${esc(c.name)}</option>`).join(''):'<option>No competitors</option>';
  $('competitor-select').disabled=!event.competitors.length;
  $('entrant-rank').textContent=competitor?.rank??'—';$('entrant-score').textContent=fmt(competitor?.score);$('entrant-score-label').textContent=event.scoreLabel;
  $('entrant-note').textContent=event.warnings[0]??(competitor?.score===null?'Scores have not been recorded yet.':event.format==='Teams'?'The team score combines its members’ recorded scores.':competitor?.members[0]?.note||'Every result contributes to the event standings.');
  $('roster').hidden=event.format!=='Teams';
  $('roster').innerHTML=competitor?.members.map(p=>`<button class="player-card" data-participant="${esc(p.name)}" aria-label="View ${esc(p.name)}’s event result">${avatar(p.name)}<span class="name">${esc(p.name)}</span><span class="player-score"><strong>${fmt(p.score)}</strong><span>${esc(event.scoreLabel)}</span></span></button>`).join('')??'<div class="empty-state">Add participants to this event to build the lineup.</div>';
  $('score-order-label').textContent=`${event.scoreOrder} score wins`;$('event-rules').textContent=event.rules||'The organiser will share the rules for this event.';
  renderClock();renderStandings();
}
function renderWinners(){
  const completed=state.model.events.filter(e=>e.status==='completed').sort((a,b)=>(b.end??b.index)-(a.end??a.index));
  $('winners-list').innerHTML=completed.length?completed.map(event=>`<article class="panel winner-history"><span class="eyebrow">${event.winners.length>1?'JOINT WINNERS':event.winnerState==='confirmed'?'CONFIRMED WINNER':'RESULT PENDING'}</span><h2>${esc(event.name)}</h2><span class="muted">${esc(dateOnly(event.start))} · ${esc(event.format)}</span><div class="winner-content">${winnerHTML(event)}</div>${prizesHTML(event)}<button class="text-button" data-event="${esc(event.id)}">View event results <span aria-hidden="true">↗</span></button></article>`).join(''):'<div class="empty-state"><strong>The first win is still to come.</strong>Confirmed winners will appear here after events are completed.</div>';
}
function renderLeaderboard(){
  const rows=state.model.leaderboards[state.board];
  $('leaderboard-description').textContent=state.board==='players'?'Individual wins plus wins earned as a member of a winning team.':'Confirmed team wins across all completed events.';
  $('leaderboard-table').innerHTML=rows.length?`<div class="table-wrap"><table><caption class="sr-only">All-time ${state.board} leaderboard by confirmed wins.</caption><thead><tr><th scope="col">RANK</th><th scope="col">${state.board==='players'?'PLAYER':'TEAM'}</th>${state.board==='players'?'<th scope="col" class="numeric hide-small">SOLO WINS</th><th scope="col" class="numeric hide-small">TEAM WINS</th>':''}<th scope="col" class="numeric">WINS</th><th scope="col" class="hide-small">RECENT WIN</th></tr></thead><tbody>${rows.map(row=>`<tr><td class="rank-cell">${String(row.rank).padStart(2,'0')}</td><td><span class="table-name">${avatar(row.name)}<span>${esc(row.name)}</span></span></td>${state.board==='players'?`<td class="numeric muted hide-small">${row.individualWins}</td><td class="numeric muted hide-small">${row.teamWins}</td>`:''}<td class="numeric score-cell">${row.wins}</td><td class="hide-small"><button class="table-name" data-event="${esc(row.lastEvent.id)}">${esc(row.lastEvent.name)}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><strong>No confirmed wins yet.</strong>The leaderboard will grow as event results are confirmed.</div>';
  $('leaderboard-note').textContent='Each completed event counts once. Joint winners each receive one win. Team wins also count for each listed member, excluding anyone marked absent.';
}
function renderHistory(){
  const past=state.model.events.filter(e=>['completed','cancelled'].includes(e.status)||phase(e).kind==='review').sort((a,b)=>(b.end??b.index)-(a.end??a.index));
  $('past-event-count').textContent=past.length;
  $('past-events').innerHTML=past.length?`<div class="table-wrap"><table><caption class="sr-only">Past events, confirmed attendance, and results.</caption><thead><tr><th scope="col">EVENT</th><th scope="col" class="hide-small">DATE</th><th scope="col">ATTENDANCE</th><th scope="col">RESULT</th></tr></thead><tbody>${past.map(e=>`<tr><td><button class="table-name" data-event="${esc(e.id)}">${esc(e.name)}</button><div class="muted history-meta">${esc(e.format)} · ${fmt(e.duration)} min</div></td><td class="muted hide-small">${esc(dateOnly(e.start))}</td><td class="muted">${esc(attendanceLabel(e))}</td><td>${e.winners.length?e.winners.map(w=>esc(w.name)).join(', '):e.status==='cancelled'?'Cancelled':'Awaiting confirmation'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><strong>No past events yet.</strong>Completed events and their attendance will be kept here.</div>';
}
function render(){
  $('event-select').innerHTML=state.model.events.length?state.model.events.map(e=>`<option value="${esc(e.id)}" ${e.id===state.eventId?'selected':''}>${esc(e.name)}</option>`).join(''):'<option>No events yet</option>';
  $('event-select').disabled=!state.model.events.length;renderOverview();renderWinners();renderLeaderboard();renderHistory();
  if(state.profile){const p=selectedEvent()?.entries.find(p=>key(p.name)===key(state.profile));if(p)renderParticipant(p);else closeParticipant();}
  renderStatus();
}
function showView(view){if(!views.includes(view))throw new Error('That section does not exist.');state.view=view;for(const name of views)$(`view-${name}`).hidden=name!==view;document.querySelectorAll('.nav-item').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('breadcrumb-current').textContent=titles[view];document.title=`${titles[view]} · Vintage Events`;}
function chooseEvent(id){const event=state.model.events.find(e=>e.id===id);if(!event)throw new Error('That event does not exist.');state.eventId=id;state.competitor='';closeParticipant();try{localStorage.setItem(preference,id);}catch{}const url=new URL(location.href);url.searchParams.delete('team');url.searchParams.set('event',id);history.replaceState(null,'',url);render();showView('overview');return{id:event.id,name:event.name,format:event.format,status:phase(event).label};}
function chooseCompetitor(name){const event=selectedEvent(),c=event?.competitors.find(c=>key(c.name)===key(name));if(!c)throw new Error('That competitor is not in this event.');state.competitor=c.name;renderOverview();showView('overview');return{name:c.name,score:c.score,rank:c.rank};}
function renderParticipant(p){const e=selectedEvent();$('participant-detail').innerHTML=`<div class="profile-name">${avatar(p.name)}<div><h2 id="dialog-title">${esc(p.name)}</h2><p class="muted">${esc(e.name)}</p></div></div><div class="profile-stats event-profile-stats"><div><span>${esc(e.scoreLabel)}</span><strong class="gold">${fmt(p.score)}</strong></div><div><span>Attendance</span><strong class="attendance-value">${p.attended===null?'Not recorded':p.attended?'Attended':'Absent'}</strong></div></div>${p.team?`<p class="muted">Team · ${esc(p.team)}</p>`:''}${p.note?`<p class="participant-note">${esc(p.note)}</p>`:''}`;}
function openParticipant(name){const p=selectedEvent()?.entries.find(p=>key(p.name)===key(name));if(!p)throw new Error('That participant is not in this event.');state.profile=p.name;renderParticipant(p);if(!$('participant-dialog').open)$('participant-dialog').showModal();}
function closeParticipant(){state.profile=null;$('participant-dialog').close();}
function renderStatus(){
  $('refresh-button').disabled=state.loading;$('refresh-button').classList.toggle('spinning',state.loading);$('refresh-button').setAttribute('aria-busy',String(state.loading));
  if(state.loading){$('sync-label').textContent='Refreshing events…';return;}
  if(state.source==='live'){$('sync-label').textContent=`Updated ${new Date(state.loadedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;notify(state.error?`The update didn’t finish. The previous results are still shown. ${state.error}`:'',!!state.error);}
  else if(state.source==='snapshot'){$('sync-label').textContent='Saved event data';notify(`Live updates are unavailable. Showing saved data from ${new Date(state.loadedAt).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})}. Use Refresh to try again.`,true);}
  else if(state.source==='error'){$('sync-label').textContent='Events unavailable';notify(state.error,true);}
}
async function csv(url,signal){const r=await fetch(url,{cache:'no-store',signal});if(!r.ok)throw new Error(`The spreadsheet returned ${r.status}. Check that both tabs are published.`);return parseCSV(await r.text());}
async function refresh(){
  if(state.loading)return;state.loading=true;renderStatus();const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try{const[results,events]=await Promise.all([csv(CONFIG.resultsCsv,controller.signal),csv(CONFIG.eventsCsv,controller.signal)]);accept(buildEvents(results,events),new Date().toISOString(),'live');}
  catch(e){state.error=e.name==='AbortError'?'The spreadsheet took too long to respond.':e instanceof TypeError?'Check your connection and the spreadsheet’s publishing settings.':e.message;if(!state.loadedAt)state.source='error';}
  finally{clearTimeout(timeout);controller.abort();state.loading=false;renderStatus();}
}
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.view){showView(button.dataset.view);window.scrollTo({top:0,behavior:'instant'});}if(button.dataset.event){chooseEvent(button.dataset.event);window.scrollTo({top:0,behavior:'instant'});}if(button.dataset.competitor){chooseCompetitor(button.dataset.competitor);$('lineup-title').scrollIntoView({block:'center',behavior:'instant'});}if(button.dataset.participant)openParticipant(button.dataset.participant);});
$('event-select').addEventListener('change',e=>chooseEvent(e.target.value));$('competitor-select').addEventListener('change',e=>chooseCompetitor(e.target.value));$('competitor-search').addEventListener('input',renderStandings);$('refresh-button').addEventListener('click',refresh);
document.querySelectorAll('input[name="leaderboard-kind"]').forEach(r=>r.addEventListener('change',()=>{state.board=r.value;renderLeaderboard();}));
$('close-dialog').addEventListener('click',closeParticipant);$('participant-dialog').addEventListener('close',()=>{state.profile=null;});$('participant-dialog').addEventListener('click',e=>{if(e.target===$('participant-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeParticipant();}});
function registerTools(){
  const ctx=document.modelContext;if(!ctx?.registerTool)return;const lifecycle=new AbortController();
  const validate=(input,field)=>{if(!input||typeof input!=='object'||Array.isArray(input)||typeof input[field]!=='string'||!input[field].trim()||Object.keys(input).some(k=>k!==field))throw new Error(`Provide one non-empty ${field}.`);return input[field];};
  const schema=field=>({type:'object',properties:{[field]:{type:'string',minLength:1}},required:[field],additionalProperties:false});
  const tools=[
    {name:'read_event_hub',title:'Read Vintage Events',description:'Read events, current standings, attendance, confirmed winners, all-time win counts, and the displayed section. Data can be live or a labelled saved snapshot.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(input&&Object.keys(input).length)throw new Error('No input fields are accepted.');const e=selectedEvent();return{source:state.source,loadedAt:state.loadedAt,view:state.view,selectedEvent:state.eventId,selectedCompetitor:state.competitor,events:state.model.events.map(e=>({id:e.id,name:e.name,format:e.format,status:phase(e).label,attendance:e.attendance,winners:e.winners.map(w=>w.name)})),standings:e?.competitors.map(({name,rank,score})=>({name,rank,score}))??[],leaderboards:state.model.leaderboards};}},
    {name:'view_event',title:'View a clan event',description:'Display an existing event, including its timer, standings, winner and optional prize. Saves the event selection on this device.',inputSchema:schema('eventId'),annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){return chooseEvent(validate(input,'eventId'));}},
    {name:'view_event_competitor',title:'View an event competitor',description:'Display an existing competitor in the selected event. This changes the displayed competitor without editing any result.',inputSchema:schema('name'),annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){return chooseCompetitor(validate(input,'name'));}},
  ];for(const tool of tools){try{Promise.resolve(ctx.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
async function start(){
  try{const response=await fetch('./snapshot.json',{cache:'no-cache'});if(response.ok){const s=await response.json();accept(buildEvents(s.results??s.fantasy,s.events??s.teams),s.capturedAt,'snapshot');notify('Connecting to your event spreadsheet…');}}catch{}
  if(!state.loadedAt)render();registerTools();await refresh();
  let historyPhases=state.model.events.map(e=>phase(e).kind).join('|');
  setInterval(()=>{renderClock();const next=state.model.events.map(e=>phase(e).kind).join('|');if(next!==historyPhases){historyPhases=next;if(state.view==='history')renderHistory();}},1000);
}
start();
