import {expect,it,vi} from 'vitest';
import {renderToString} from 'react-dom/server';
import {createElement} from 'react';
import {App} from '../../src/web/App.jsx';
import {sampleDashboard} from '../../src/web/sample';
import {parse} from 'parse5';
it('keeps key details visible in the reading flow and removes the promotional sidebar',()=>{
 vi.stubGlobal('location',{search:'?demo=1'});
 try {
  const html=renderToString(createElement(App));
  const doc=parse(html);
  const nodes=[];const visit=node=>{nodes.push(node);for(const child of node.childNodes??[])visit(child);};visit(doc);
  const text=node=>node.nodeName==='#text'?node.value:(node.childNodes??[]).map(text).join('');
  const collapsible=nodes.filter(node=>node.tagName==='details').map(text).join(' ');
  expect(collapsible).not.toContain(sampleDashboard.edition.groups[0].keyDetails[0]);
  expect(text(doc)).toContain(sampleDashboard.edition.groups[0].keyDetails[0]);
  expect(html).not.toContain('A little more');
  expect(html).toContain('Read original');
 } finally {vi.unstubAllGlobals();}
});
it('renders exported reporting through the production dashboard without entering demo mode',()=>{
 const snapshot=structuredClone(sampleDashboard);
 snapshot.edition.overview='Collected <reporting> for today';
 vi.stubGlobal('window',{__BRIEF_SNAPSHOT__:snapshot});
 vi.stubGlobal('location',{search:'?demo=1'});
 try {
  const html=renderToString(createElement(App));
  expect(html).toContain('Collected &lt;reporting&gt; for today');
  expect(html).toContain('Sources &amp; evidence');
  expect(html).toContain('Saved edition');
  expect(html).not.toContain('Sample edition');
 } finally {vi.unstubAllGlobals();}
});
it('renders a clearly marked sample edition with rich stories and source links',()=>{
 vi.stubGlobal('location',{search:'?demo=1'});
 const html=renderToString(createElement(App));
 expect(html).toContain('Sample edition');expect(html).toContain('Agents that pick up where they left off.');expect(html).toContain('https://developers.cloudflare.com/agents/harnesses/pi/');expect(html).toContain('Sources &amp; evidence');expect(html).toContain('Plan tasks');
 vi.unstubAllGlobals();
});
it('does not silently substitute a sample brief for the live service',()=>{
 vi.stubGlobal('location',{search:''});
 const html=renderToString(createElement(App));expect(html).not.toContain('Agents that pick up');expect(html).toContain('Gathering your brief');vi.unstubAllGlobals();
});
