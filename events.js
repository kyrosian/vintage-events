import {normalise,key,parseCSV,escapeHtml,slug} from './league.js';
export {normalise,key,parseCSV,escapeHtml,slug};
const number=(value,label,optional=false)=>{if(!normalise(value)&&optional)return null;const n=Number(normalise(value).replace(/,/g,''));if(!Number.isFinite(n)||n<0)throw new Error(`${label} must be a number of zero or above.`);return n;};
const headerMap=row=>new Map(row.map((name,i)=>[key(name),i]));
const get=(row,headers,name)=>normalise(row[headers.get(key(name))]);
function recapImage(value){
  const raw=normalise(value);if(!raw)return{url:'',valid:true};
  try{const url=new URL(raw);return{url:['http:','https:'].includes(url.protocol)?url.href:'',valid:['http:','https:'].includes(url.protocol)};}catch{return{url:'',valid:false};}
}
function rank(items,order='Highest',field='score'){
  const sorted=[...items].sort((a,b)=>a[field]===null&&b[field]!==null?1:b[field]===null&&a[field]!==null?-1:(a[field]===b[field]?0:(order==='Lowest'?a[field]-b[field]:b[field]-a[field]))||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
  let position=null;
  return sorted.map((item,i)=>{if(item[field]===null)return{...item,rank:null};if(i===0||item[field]!==sorted[i-1][field])position=i+1;return{...item,rank:position};});
}
function timestamp(value,label){
  if(!value)return null;
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/i);
  if(!match)throw new Error(`${label}: use an ISO start time with a timezone, such as 2026-09-20T19:00:00+01:00.`);
  const [,y,m,d,h,min,s='0',zone]=match;
  if(+m<1||+m>12||+d<1||+d>new Date(Date.UTC(+y,+m,0)).getUTCDate()||+h>23||+min>59||+s>59||zone!=='Z'&&zone!=='z'&&(+zone.slice(1,3)>23||+zone.slice(4,6)>59))throw new Error(`${label}: the date or time is invalid.`);
  const n=Date.parse(value);if(!Number.isFinite(n))throw new Error(`${label}: the date or time is invalid.`);return n;
}

function migrateLegacy(resultsRows,eventRows){
  const members=new Map();
  for(let i=0;i<eventRows.length-1;i++){
    const name=normalise(eventRows[i][0]);if(!name||key(eventRows[i+1][0])!=='players')continue;
    for(let n=0;n<5;n++){const player=normalise(eventRows[i+2+n]?.[0]);if(player&&!members.has(key(player)))members.set(key(player),name);}
  }
  const results=[['Event ID','Player','Team','Score','Attended','Note']];
  for(const row of resultsRows.slice(1)){
    const name=normalise(row[0]);if(!name)continue;
    const hasScore=row.slice(5,12).some(v=>normalise(v)!=='')||Number(normalise(row[12]))>0;
    results.push(['event-001',name,members.get(key(name))??'',hasScore?normalise(row[12]):'','','']);
  }
  const events=[['Event ID','Event name','Format','Status','Start (ISO)','Duration (minutes)','Score label','Score order','Winner','Prize pool','Prize details','Rules'],['event-001','Vintage clan event',members.size?'Teams':'Individual','Draft','','90','Points','Highest','','','','']];
  return{results,events};
}

export function buildEvents(resultsRows,eventRows){
  let legacy=false;
  if(key(resultsRows[0]?.[0])==='player'&&eventRows.some(row=>key(row[0])==='players')){
    const migrated=migrateLegacy(resultsRows,eventRows);resultsRows=migrated.results;eventRows=migrated.events;legacy=true;
  }
  const eh=headerMap(eventRows[0]??[]),rh=headerMap(resultsRows[0]??[]);
  for(const name of ['Event ID','Event name','Format','Status'])if(!eh.has(key(name)))throw new Error('The Events tab is missing a required heading. Use the Vintage Events template.');
  for(const name of ['Event ID','Player','Team','Score','Attended'])if(!rh.has(key(name)))throw new Error('The Results tab is missing a required heading. Use the Vintage Events template.');
  if(eventRows.slice(1).some(row=>get(row,eh,'Event name')&&!get(row,eh,'Event ID')))throw new Error('Each named event needs a permanent Event ID.');
  const ids=new Set();
  const events=eventRows.slice(1).filter(row=>get(row,eh,'Event ID')).map((row,index)=>{
    const id=get(row,eh,'Event ID'),name=get(row,eh,'Event name');
    if(ids.has(key(id)))throw new Error(`Event ID “${id}” is used more than once.`);ids.add(key(id));
    if(!name)throw new Error(`Add an event name for “${id}”.`);
    const rawFormat=key(get(row,eh,'Format'))||'individual';if(!['individual','teams'].includes(rawFormat))throw new Error(`“${name}” must use Individual or Teams format.`);
    const rawStatus=key(get(row,eh,'Status'))||'draft';if(!['draft','scheduled','live','completed','cancelled'].includes(rawStatus))throw new Error(`“${name}” has an unrecognised status.`);
    const order=key(get(row,eh,'Score order'))||'highest';if(!['highest','lowest'].includes(order))throw new Error(`“${name}” must use Highest or Lowest score order.`);
    const duration=number(get(row,eh,'Duration (minutes)')||90,`${name}’s duration`);if(duration<=0)throw new Error(`“${name}” needs a duration greater than zero.`);
    const start=timestamp(get(row,eh,'Start (ISO)'),name);
    const recap=recapImage(get(row,eh,'Recap image URL'));
    const warnings=recap.valid?[]:['The recap image link for this event was ignored. Use a complete http(s) image URL.'];
    return{id,name,index,format:rawFormat==='teams'?'Teams':'Individual',status:rawStatus,duration,start,end:start===null?null:start+duration*60_000,scoreLabel:get(row,eh,'Score label')||'Points',scoreOrder:order==='lowest'?'Lowest':'Highest',manualWinner:get(row,eh,'Winner'),prize:get(row,eh,'Prize pool'),prizeDetails:get(row,eh,'Prize details'),rules:get(row,eh,'Rules'),recapTitle:get(row,eh,'Recap title'),recapText:get(row,eh,'Recap write-up'),recapImage:recap.url,entries:[],competitors:[],warnings};
  });
  const eventMap=new Map(events.map(e=>[key(e.id),e]));const playerKeys=new Set();
  for(const row of resultsRows.slice(1)){
    const id=get(row,rh,'Event ID'),name=get(row,rh,'Player');if(!id&&!name)continue;
    if(!id||!name)throw new Error('Each Results row needs an Event ID and a player name.');
    const event=eventMap.get(key(id));if(!event)throw new Error(`Results reference unknown event ID “${id}”.`);
    const unique=`${key(id)}\0${key(name)}`;if(playerKeys.has(unique))throw new Error(`“${name}” appears more than once in “${event.name}”.`);playerKeys.add(unique);
    const attendance=key(get(row,rh,'Attended'));if(!['','yes','no','true','false'].includes(attendance))throw new Error(`Attendance for “${name}” must be Yes, No, or blank.`);
    event.entries.push({name,team:get(row,rh,'Team'),score:number(get(row,rh,'Score'),`${name}’s score`,true),attended:attendance===''?null:['yes','true'].includes(attendance),note:get(row,rh,'Note')});
  }
  for(const event of events){
    const eligible=event.entries.filter(p=>p.attended!==false);
    if(event.format==='Individual')event.competitors=rank(eligible.map(p=>({name:p.name,score:p.score,members:[p]})),event.scoreOrder);
    else{
      const groups=new Map();
      for(const p of eligible){if(!p.team)continue;const id=key(p.team);if(!groups.has(id))groups.set(id,{name:p.team,members:[]});groups.get(id).members.push(p);}
      event.competitors=rank([...groups.values()].map(t=>({...t,score:t.members.some(p=>p.score!==null)?t.members.reduce((sum,p)=>sum+(p.score??0),0):null})),event.scoreOrder);
      const unassigned=eligible.filter(p=>!p.team).length;if(unassigned)event.warnings.push(`${unassigned} participant${unassigned===1?' needs':'s need'} a team in the Results sheet.`);
    }
    event.attendance={confirmed:event.entries.filter(p=>p.attended===true).length,unknown:event.entries.filter(p=>p.attended===null).length,absent:event.entries.filter(p=>p.attended===false).length};
    event.winners=[];event.winnerState=event.status==='completed'?'pending':'unconfirmed';
    if(event.status==='completed'){
      if(event.manualWinner){
        const winner=event.competitors.find(c=>key(c.name)===key(event.manualWinner));
        if(winner){event.winners=[winner];event.winnerState='confirmed';}else event.warnings.push('The Winner field does not match an eligible competitor. Check the exact player or team name.');
      }else{
        const top=event.competitors.find(c=>c.score!==null);if(top){event.winners=event.competitors.filter(c=>c.score===top.score);event.winnerState='confirmed';}
      }
    }
  }
  return{events,legacy,leaderboards:allTime(events)};
}

export function allTime(events){
  const players=new Map(),teams=new Map();
  function credit(map,name,event,type){
    const id=key(name);if(!map.has(id))map.set(id,{name,wins:0,points:0,individualWins:0,teamWins:0,eventIds:[],lastEvent:null});
    const record=map.get(id);if(record.eventIds.includes(event.id))return;
    record.eventIds.push(event.id);record.wins++;record.points++;record[type]++;
    if(!record.lastEvent||(event.end??event.index)>(record.lastEvent.end??record.lastEvent.index))record.lastEvent={id:event.id,name:event.name,end:event.end,index:event.index};
  }
  for(const event of events){if(event.status!=='completed'||event.winnerState!=='confirmed')continue;
    for(const winner of event.winners){
      if(event.format==='Teams'){
        credit(teams,winner.name,event,'teamWins');
        for(const member of winner.members)if(member.attended!==false)credit(players,member.name,event,'teamWins');
      }else credit(players,winner.name,event,'individualWins');
    }
  }
  return{players:rank([...players.values()],'Highest','wins'),teams:rank([...teams.values()],'Highest','wins')};
}

export function phase(event,now=Date.now()){
  if(event.status==='completed')return{label:'Completed',kind:'completed',caption:'EVENT FINISHED',time:null,progress:100};
  if(event.status==='cancelled')return{label:'Cancelled',kind:'cancelled',caption:'EVENT CANCELLED',time:null,progress:0};
  if(event.status==='draft')return{label:'Draft',kind:'draft',caption:'TO BE SCHEDULED',time:null,progress:0};
  if(event.start===null)return{label:event.status==='live'?'Live':'Scheduled',kind:event.status,caption:'START TIME NOT SET',time:null,progress:0};
  if(now<event.start)return{label:'Scheduled',kind:'scheduled',caption:'STARTS IN',time:event.start-now,progress:0};
  if(now<event.end)return{label:'Live',kind:'live',caption:'TIME REMAINING',time:event.end-now,progress:Math.max(0,(now-event.start)/(event.end-event.start)*100)};
  return{label:'Awaiting results',kind:'review',caption:'TIME’S UP',time:0,progress:100};
}
export function attendanceLabel(event){const a=event.attendance;if(a.unknown===event.entries.length)return'Not recorded';if(a.unknown)return`${a.confirmed} confirmed · ${a.unknown} unrecorded`;return`${a.confirmed} attended`;}
