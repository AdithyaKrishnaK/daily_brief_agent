import { test,expect } from 'playwright/test';
import { sampleDashboard } from '../../src/web/sample';
test('reads story details and confirms only the edited two-task preview',async({page})=>{
 let creates=0;let draft:any;
 await page.route('**/api/**',async route=>{
  const request=route.request();const path=new URL(request.url()).pathname;
  let data:any={...sampleDashboard,connections:[{name:'Todoist',configured:true,detail:'Fixture'},{name:'Notion',configured:true,detail:'Fixture'}]};
  if(path.endsWith('/task-drafts')&&request.method()==='POST'){draft={id:'draft',articleId:'a1',version:1,status:'draft',instruction:'Read and reproduce',tasks:[{id:'read',title:'Read article',description:'https://example.com'},{id:'reproduce',title:'Reproduce work',description:'https://example.com',precedingTaskId:'read'}]};data=draft;}
  else if(path==='/api/task-drafts/draft'&&request.method()==='PUT'){draft={...draft,...request.postDataJSON(),version:2};data=draft;}
  else if(path.endsWith('/confirm')){creates++;data=draft.tasks.map((t:any)=>({key:t.id,provider:'todoist',status:'succeeded',externalId:t.id}));}
  else if(path.endsWith('/notion'))data={key:'notion',provider:'notion',status:'succeeded',url:'https://notion.so/saved'};
  await route.fulfill({json:{data}});
 });
 await page.goto('/');await expect(page.getByRole('heading',{name:'Agents that pick up where they left off.'})).toBeVisible();
 await page.getByText('Sources & evidence').first().click();await expect(page.getByText('Each story brings its evidence', {exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Plan tasks'}).first().click();await page.getByLabel('What would you like to do?').fill('Read this article and reproduce the work');await page.getByRole('button',{name:'Preview tasks'}).click();
 await expect(page.getByLabel('Task 1 title')).toHaveValue('Read article');await expect(page.getByLabel('Task 2 title')).toHaveValue('Reproduce work');expect(creates).toBe(0);
 await page.getByLabel('Task 1 title').fill('Read carefully');await page.getByRole('button',{name:'Save preview changes'}).click();await page.getByRole('button',{name:'Create 2 tasks in Todoist'}).click();await expect(page.getByText('Created in Todoist').first()).toBeVisible();expect(creates).toBe(1);
});
test('sample edition is clearly marked and works on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?demo=1');await expect(page.getByText('Sample edition', {exact:false}).first()).toBeVisible();await expect(page.getByRole('heading',{name:'Your morning brief'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('failed settings persistence never reports success',async({page})=>{
 await page.route('**/api/dashboard',route=>route.fulfill({json:{data:sampleDashboard}}));
 await page.route('**/api/settings',route=>route.fulfill({status:400,json:{error:{code:'invalid_input',message:'Invalid time zone'}}}));
 await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Save settings'}).click();
 await expect(page.getByRole('alert')).toContainText('Invalid time zone');await expect(page.getByText('Settings saved for the next edition.')).toHaveCount(0);
});
