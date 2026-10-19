import { defaultSettings } from '../shared/contracts';
export const sampleDashboard = {
  settings:defaultSettings,connections:[{name:'Todoist',configured:false,detail:'Connect in deployment settings'},{name:'Notion',configured:false,detail:'Share your reading database'}],actions:[],drafts:[],previous:null,history:[],
  profile:{version:0,weights:{},follows:[],suppressions:[],taskStyle:[],evidence:[]},
  articles:[
    {id:'a1',title:'A practical guide to durable agents',url:'https://developers.cloudflare.com/agents/harnesses/pi/',sources:['Hacker News','Cloudflare'],topics:['Agents','Engineering'],contentStatus:'excerpt',content:''},
    {id:'a2',title:'What to watch in AI research',url:'https://www.anthropic.com/news',sources:['Anthropic'],topics:['Research'],contentStatus:'title-only',content:''},
    {id:'a3',title:'The tools behind the next idea',url:'https://techcrunch.com/',sources:['TechCrunch'],topics:['Startups'],contentStatus:'title-only',content:''}
  ],
  edition:{id:'sample',localDate:'2026-10-18',revision:1,status:'ready',profileVersion:0,startedAt:'2026-10-18T00:00:00Z',updatedAt:'2026-10-18T00:30:00Z',sourceOutcomes:[],overview:'A little context before the day begins. Explore how a personal brief connects the developments worth knowing with the things you want to do next.',groups:[
    {id:'g1',headline:'Agents that pick up where they left off.',summary:'Durable execution gives a long-running agent a way to recover its work after an interruption. This example shows how the brief can connect a technical development to a useful experiment of your own.',keyDetails:['Each story brings its evidence with it, so you can go deeper without losing your place.','A natural-language request becomes an editable task preview before anything reaches Todoist.'],evidenceArticleIds:['a1'],topics:['Agents','Engineering'],relevance:'An example of a development you might want to read about and reproduce.'},
    {id:'g2',headline:'Make room for the research behind the release.',summary:'Research and product announcements deserve different kinds of attention. Your brief will group related reporting and explain what the available sources actually support.',keyDetails:['This is sample editorial content, not a summary of a current announcement.'],evidenceArticleIds:['a2'],topics:['Research']},
    {id:'g3',headline:'Leave a little space for the unexpected.',summary:'Your interests should sharpen the brief without closing it off. Discovery stories keep useful ideas from outside your usual reading in view.',keyDetails:['More like this and Less like this help you shape future editions.'],evidenceArticleIds:['a3'],topics:['Startups']}
  ]}
};
