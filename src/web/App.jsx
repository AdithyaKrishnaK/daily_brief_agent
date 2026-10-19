import { useEffect, useState } from 'react';
import { api } from './api';
import { sampleDashboard } from './sample';
import { TaskComposer } from './components/TaskComposer.jsx';
import { SettingsPanel, InterestsPanel } from './components/SettingsPanel.jsx';

const readableDate=(date)=>new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
export function App(){
 const snapshot=typeof window==='undefined'?undefined:window.__BRIEF_SNAPSHOT__;
 const [demo,setDemo]=useState(!snapshot&&new URLSearchParams(location.search).get('demo')==='1');
 const [data,setData]=useState(()=>snapshot??(demo?structuredClone(sampleDashboard):null));const [error,setError]=useState('');const [view,setView]=useState('today');const [selected,setSelected]=useState(null);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [historyEdition,setHistoryEdition]=useState(null);
 async function load(){try{setData(demo?structuredClone(sampleDashboard):await api('/dashboard'));setError('');}catch(e){setError(e.message);}}
 useEffect(()=>{load();},[demo]);
 useEffect(()=>{if(!data||demo||snapshot||data.edition?.status!=='running')return;const id=setInterval(load,4000);return()=>clearInterval(id);},[data?.edition?.status,demo]);
 async function mutate(path,method='POST',body){if(demo){setNotice('This is a sample edition. Connect the service to keep changes.');return;}try{setBusy(true);await api(path,method,body);await load();}catch(e){setNotice(e.message);}finally{setBusy(false);}}
 const active=data?.edition;const published=historyEdition??(active&&['ready','partial'].includes(active.status)?active:data?.previous);
 return <div className="paper">
  <a className="skip-link" href="#brief-content">Skip to content</a>
  <header className="masthead"><a className="wordmark" href={snapshot?'#brief-content':'/'} aria-label="Morning brief home">Morning brief<span className="wordmark-dot">.</span></a><span className="edition-mark">{data?`${data.settings.deliveryTime} · ${data.settings.timeZone.replaceAll('_',' ')}`:'06:00 · Asia/Kolkata'}</span></header>
  <nav className="navigation" aria-label="Main navigation"><div>{[['today','Today'],['history','Archive'],['interests','Interests'],['settings','Settings']].map(([id,label])=><button key={id} aria-current={view===id?'page':undefined} className={view===id?'nav-active':''} onClick={()=>{setView(id);setHistoryEdition(null);}}>{label}</button>)}</div></nav>
  {demo&&<div className="demo-banner">Sample edition · Illustrative content, not today’s news. External actions are disabled.<button onClick={()=>{setData(null);setDemo(false);}}>Return to live brief ↗</button></div>}
  {snapshot&&<div className="demo-banner">Saved edition · Read-only copy. Open the interactive app to save to Notion or create Todoist tasks.</div>}
  {!snapshot&&!demo&&data?.connections.some(c=>['Notion','Todoist'].includes(c.name)&&!c.configured)&&<div className="demo-banner">Connect your accounts to save articles and create tasks.<button onClick={()=>setView('settings')}>Connection setup</button></div>}
  {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notification">×</button></div>}
  {!data?<main id="brief-content" className="empty"><span className="eyebrow">THE FIRST EDITION</span><h1>Your morning brief</h1><p>{error||'Gathering your brief…'}</p>{error&&<div className="button-row"><button className="primary" onClick={load}>Try again</button><button onClick={()=>setDemo(true)}>Explore a sample brief ↗</button>{error.includes('session')&&<a href="/cdn-cgi/access/login">Sign in with Google</a>}</div>}</main>:<>
   {view==='settings'?<SettingsPanel settings={data.settings} connections={data.connections} demo={demo} onSave={async settings=>{if(demo){setNotice('Sample settings are not saved.');return false;}await api('/settings','PUT',settings);await load();return true;}}/>:
   view==='interests'?<InterestsPanel profile={data.profile} onSave={input=>mutate('/interests','PUT',input)} onRemove={id=>mutate(`/feedback/${encodeURIComponent(id)}`,'DELETE')}/>:
   view==='history'&&!historyEdition?<main className="section-page"><h1>Archive</h1><p className="page-intro">Past editions, exactly as you received them.</p>{data.history.filter(e=>e.overview).length?data.history.filter(e=>e.overview).map(e=><button className="archive-row" key={e.id} onClick={()=>setHistoryEdition(e)}><span>{readableDate(e.localDate)}</span><span>{e.groups.length} stories <span className="arrow">↗</span></span></button>):<p>Your first edition will appear here after it is published.</p>}</main>:
   <main id="brief-content">
    <section className="opening"><p className="eyebrow">{historyEdition?'Archive · ':''}{published?readableDate(published.localDate):'Today'}</p><div className="heading-row"><h1>Your morning brief</h1>{published&&<span className="story-count">{published.groups.length} stories</span>}</div></section>
    <div className="reading-layout"><section className="stories">
     {active?.status==='running'&&<div className="run-message" role="status">Your next brief is taking shape. {published?'Keep reading the previous edition below.':'You can leave this page; collection continues in the background.'}</div>}
     {active?.status==='failed'&&<div className="run-message error" role="alert">The latest brief could not finish. {active.error} Your previous edition is still available.</div>}
     {published?.status==='partial'&&<div className="run-message">Partial edition · Some sources could not be checked. See source status for details.</div>}
     {published?<><div className="editors-note"><h2 className="eyebrow">In brief</h2><p>{published.overview}</p></div>{published.groups.map((group,index)=><StoryCard key={`${published.id}:${group.id}`} group={group} index={index} articles={data.articles.filter(a=>group.evidenceArticleIds.includes(a.id))} demo={demo} readOnly={Boolean(snapshot)} connections={data.connections} actions={data.actions} onPlan={article=>setSelected(article)} onFeedback={(kind)=>mutate('/feedback','POST',{id:crypto.randomUUID(),kind,targetId:group.id,topics:group.topics,at:new Date().toISOString()})} onNotice={setNotice} onSaved={load}/>)}</>:<section className="first-edition"><span className="sun">◒</span><h2>A fresh start, every morning.</h2><p>Your first brief is ready to be made. We’ll check your sources and bring the useful parts together.</p><button className="primary" disabled={busy} onClick={()=>mutate('/refresh')}>{busy?'Starting…':'Prepare my first brief ↗'}</button></section>}
     {data.articles.length>0&&<details className="all-articles"><summary>Browse all collected articles <span>{data.articles.length}</span></summary>{data.articles.map(a=><div className="collected-row" key={a.id}><a href={a.url} target="_blank" rel="noreferrer">{a.title} ↗</a><small>{a.sources.join(' · ')} · {a.contentStatus}</small>{!snapshot&&<button onClick={()=>setSelected(a)}>Plan tasks</button>}</div>)}</details>}
    </section></div>
    <details className="source-status"><summary>Source status <span>{active?.sourceOutcomes.some(o=>!o.ok)?'Some sources unavailable':'View checked sources'}</span></summary><div className="source-box">{data.settings.sources.filter(s=>s.enabled).map(s=>{const outcome=active?.sourceOutcomes.find(o=>o.sourceId===s.id);return <div className="source-row" key={s.id}><strong>{s.name}</strong><span>{outcome?(outcome.ok?`${outcome.count} items checked`:outcome.error):'Not checked yet'}</span></div>;})}</div>{!snapshot&&<div className="button-row"><button onClick={()=>setView('settings')}>Manage sources</button><button disabled={busy||active?.status==='running'} onClick={()=>mutate('/refresh')}>{active?.status==='running'?'Preparing…':'Refresh brief'}</button></div>}</details>

   </main>}
   {selected&&<TaskComposer article={selected} initialDraft={data.drafts?.find(d=>d.articleId===selected.id)} actions={data.actions} demo={demo} connected={data.connections.some(c=>c.name==='Todoist'&&c.configured)} onClose={()=>{setSelected(null);load();}}/>} 
  </>}
  <footer className="footer"><span>Morning brief</span><span>Hacker News · TechCrunch · Anthropic · OpenAI</span></footer>
 </div>;
}
function StoryCard({group,index,articles,demo,readOnly,connections,actions,onPlan,onFeedback,onNotice,onSaved}){
 const [saving,setSaving]=useState(false);const [localReceipt,setLocalReceipt]=useState(null);const [signal,setSignal]=useState('');const article=articles[0];
 const receipt=localReceipt??actions.find(a=>a.provider==='notion'&&article&&a.key.endsWith(`:${article.id}`));
 const connected=connections.some(c=>c.name==='Notion'&&c.configured);
 async function save(){if(demo){onNotice('Connect Notion to save articles from your live brief.');return;}try{setSaving(true);const result=await api(`/articles/${article.id}/notion`,'POST');setLocalReceipt(result);if(result.status==='succeeded')onSaved();else onNotice(result.error??'Check the save status.');}catch(e){onNotice(e.message);}finally{setSaving(false);}}
 return <article className="story" aria-labelledby={`story-${group.id}`}><div className="story-topline"><span className="story-number">{String(index+1).padStart(2,'0')}</span><span className="story-sources">{[...new Set(articles.flatMap(a=>a.sources))].join(' / ')}</span><span className="story-tags">{group.topics.slice(0,2).join(' · ')}</span></div>
  <h2 id={`story-${group.id}`}>{group.headline}</h2><p className="story-summary">{group.summary}</p>
  {group.keyDetails.length>0&&<ul className="key-details">{group.keyDetails.map((detail,i)=><li key={i}>{detail}</li>)}</ul>}
  {group.change&&<p className="change"><strong>What changed:</strong> {group.change}</p>}
  {group.relevance&&<p className="relevance"><strong>Why it matters to you:</strong> {group.relevance}</p>}
  <details className="story-details"><summary>Sources &amp; evidence <span aria-hidden="true">＋</span></summary><div className="evidence">{articles.map(a=><div key={a.id}><a href={a.url} target="_blank" rel="noreferrer">{a.title} ↗</a><small>{a.contentStatus==='full'?'Article available':a.contentStatus==='excerpt'?'Based on an excerpt':'Full text unavailable'}{a.points?` · ${a.points} HN points`:''}</small>{a.commentsUrl&&<a className="discussion" href={a.commentsUrl} target="_blank" rel="noreferrer">HN discussion ↗</a>}</div>)}</div></details>
  <div className="story-actions"><div className="button-row">{article&&<a className="read-original" href={article.url} target="_blank" rel="noreferrer">Read original ↗</a>}{!readOnly&&<><button className="save-button" disabled={!article||saving||(!connected&&!demo)||receipt?.status==='succeeded'} onClick={save}>{saving?'Saving…':receipt?.status==='succeeded'?'✓ Saved to Notion':'Save to Notion'}</button><button disabled={!article} onClick={()=>onPlan(article)}>Plan tasks</button>{receipt?.url&&<a href={receipt.url} target="_blank" rel="noreferrer">Open in Notion ↗</a>}</>}</div>{!readOnly&&<div className="feedback" aria-label="Story feedback">{[['more','More like this','↑'],['less','Less like this','↓'],['known','Already know this','✓']].map(([kind,label,icon])=><button key={kind} title={label} aria-label={label} aria-pressed={signal===kind} onClick={()=>{setSignal(kind);onFeedback(kind);}}>{icon}</button>)}</div>}</div>
 </article>;
}
