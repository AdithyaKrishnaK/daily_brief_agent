import { expect,it } from 'vitest';
import { TodoistAdapter } from '../../src/worker/integrations/todoist';
it('maps only specified task fields and preserves a stable provider request ID',async()=>{
 let payload:any;let requestId:string|null=null;
 const adapter=new TodoistAdapter('secret','Asia/Kolkata','allowed-project',async(url,options)=>{expect(String(url)).toBe('https://api.todoist.com/api/v1/tasks');payload=JSON.parse(String(options?.body));requestId=new Headers(options?.headers).get('X-Request-Id');return new Response(JSON.stringify({id:'task-1',url:'https://app.todoist.com/app/task/task-1'}));});
 const result=await adapter.createTask({id:'one',title:'Read article',description:'https://example.com',due:'tomorrow',priority:3},'stable-key');
 expect(payload).toMatchObject({content:'Read article',due_string:'tomorrow',due_timezone:'Asia/Kolkata',priority:3});expect(payload.project_id).toBe('allowed-project');expect(requestId).toBe('stable-key');expect(result.externalId).toBe('task-1');
});

it('rejects caller destinations and missing project configuration before network access',async()=>{
 let calls=0;const http:typeof fetch=async()=>{calls++;return Response.json({id:'unexpected'});};
 const task={id:'one',title:'Read',description:''};
 await expect(new TodoistAdapter('secret','Asia/Kolkata','',http).createTask(task,'key')).rejects.toThrow('TODOIST_PROJECT_ID');
 await expect(new TodoistAdapter('secret','Asia/Kolkata','allowed',http).createTask({...task,projectId:'other'} as any,'key')).rejects.toThrow();
 expect(calls).toBe(0);
});
it('checks access to the configured project',async()=>{
 let target='';
 const adapter=new TodoistAdapter('secret','UTC','fixed/project',async input=>{target=String(input);return Response.json({id:'fixed/project'});});
 expect(await adapter.check()).toBe(true);
 expect(target).toBe('https://api.todoist.com/api/v1/projects/fixed%2Fproject');
});
