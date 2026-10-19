import type {PiService} from './pi';
import type {IntegrationWrites} from './credentials';
import type { BriefAgent } from './brief-agent';
export interface Env {
 AGENT: DurableObjectNamespace<BriefAgent>;
 ASSETS: Fetcher;
 ACCESS_TEAM_DOMAIN:string;
 ACCESS_AUD:string;
 OWNER_EMAIL:string;
 APP_ORIGIN:string;
 PI:Service<PiService>;
 INTEGRATIONS:Service<IntegrationWrites>;
}
