import { z } from 'zod';
export const SourceSchema = z.object({ id: z.string().min(1), name: z.string().min(1), kind: z.enum(['hackernews', 'rss', 'html']), url: z.url(), enabled: z.boolean() });
export const SettingsSchema = z.object({ sources: z.array(SourceSchema).max(20), timeZone: z.string().refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }), deliveryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), collectionLeadMinutes: z.number().int().min(5).max(120) });
export type Settings = z.infer<typeof SettingsSchema>;
export type SourceConfig = z.infer<typeof SourceSchema>;
export interface Article { id: string; url: string; title: string; sources: string[]; publishedAt?: string; topics: string[]; content: string; contentStatus: 'full' | 'excerpt' | 'title-only' | 'unavailable'; points?: number; commentsUrl?: string }
export const GroupSchema = z.object({ id: z.string(), headline: z.string().min(1), summary: z.string().min(1), keyDetails: z.array(z.string()).max(8), evidenceArticleIds: z.array(z.string()).min(1), topics: z.array(z.string()).max(8), relevance: z.string().optional(), change: z.string().optional() });
export const BriefSchema = z.object({ overview: z.string().min(1), groups: z.array(GroupSchema).max(10) });
export type BriefContent = z.infer<typeof BriefSchema>;
export type StoryGroup = z.infer<typeof GroupSchema>;
export interface SourceOutcome { sourceId: string; ok: boolean; count: number; error?: string }
export interface Edition extends BriefContent { id: string; localDate: string; revision: number; status: 'running' | 'ready' | 'partial' | 'failed'; profileVersion: number; sourceOutcomes: SourceOutcome[]; startedAt: string; updatedAt: string; error?: string }
export interface InterestProfile { version: number; weights: Record<string, number>; follows: string[]; suppressions: string[]; taskStyle: string[]; evidence: FeedbackEvent[] }
export const FeedbackSchema = z.object({ id: z.string(), kind: z.enum(['more', 'less', 'known', 'follow', 'save', 'task', 'task-edit', 'click']), targetId: z.string(), topics: z.array(z.string()).default([]), payload: z.string().max(2000).optional(), at: z.string() });
export type FeedbackEvent = z.infer<typeof FeedbackSchema>;
export const DraftTaskSchema = z.object({ id: z.string().min(1), title: z.string().min(1).max(500), description: z.string().max(5000), due: z.string().max(200).optional(), priority: z.number().int().min(1).max(4).optional(), precedingTaskId: z.string().optional() }).strict();
export type DraftTask = z.infer<typeof DraftTaskSchema>;
export const TaskPlanSchema = z.object({ tasks: z.array(DraftTaskSchema).max(12), clarification: z.string().optional() }).refine(v => v.tasks.length > 0 || Boolean(v.clarification), 'Tasks or a clarification are required');
export interface TaskDraft { id: string; articleId: string; version: number; instruction: string; tasks: DraftTask[]; status: 'draft' | 'confirmed'; clarification?: string; timeZone:string; plannedAt:string }
export interface ActionReceipt { key: string; provider: 'todoist' | 'notion'; status: 'pending' | 'inflight' | 'succeeded' | 'failed' | 'uncertain'; fingerprint: string; externalId?: string; url?: string; error?: string }
export interface ConnectionStatus { name: string; configured: boolean; detail: string }
export interface DashboardState { edition: Edition | null; previous: Edition | null; history: Edition[]; articles: Article[]; profile: InterestProfile; settings: Settings; connections: ConnectionStatus[]; actions: ActionReceipt[]; drafts:TaskDraft[] }
export const defaultSettings: Settings = { timeZone: 'Asia/Kolkata', deliveryTime: '06:00', collectionLeadMinutes: 30, sources: [
  { id: 'hn', name: 'Hacker News', kind: 'hackernews', url: 'https://news.ycombinator.com/', enabled: true },
  { id: 'tc', name: 'TechCrunch', kind: 'rss', url: 'https://techcrunch.com/feed/', enabled: true },
  { id: 'anthropic', name: 'Anthropic', kind: 'html', url: 'https://www.anthropic.com/news', enabled: true },
  { id: 'openai', name: 'OpenAI', kind: 'rss', url: 'https://openai.com/news/rss.xml', enabled: true }
] };
export class AppError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
