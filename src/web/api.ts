import type { DashboardState } from '../shared/contracts';
declare global { interface Window { __BRIEF_SNAPSHOT__?: DashboardState } }
export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const snapshot = typeof window === 'undefined' ? undefined : window.__BRIEF_SNAPSHOT__;
  if (snapshot) {
    if (method === 'GET' && path === '/dashboard') return structuredClone(snapshot) as T;
    throw new Error('This saved brief is read-only. Open the running app to save changes.');
  }
  const response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(response.status===401)throw new Error('Your session has expired. Sign in again to continue.');
  const type=response.headers.get('content-type')??'';
  if(!type.includes('application/json'))throw new Error('The brief service is not connected. Start the Worker or check setup.');
  const result=await response.json() as {data:T;error?:{message:string}};
  if(!response.ok||result.error)throw new Error(result.error?.message??'The request could not be completed.');return result.data;
}
