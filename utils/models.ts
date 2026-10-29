/** Official model audit: 2026-10-29. Sources and limitations: api/README.md. */
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export interface ModelPricing {
  input: number;
  cachedInput: number;
  output: number;
  cacheWrite?: number;
  cacheWrite12h?: number;
}
export interface ModelDef extends ModelPricing {
  id: string;
  name: string;
  maxOutput: number;
  context: string;
  desc: string;
  category?: string;
  tags: ('balanced' | 'smart' | 'fast' | 'next-gen')[];
  longContextPricing?: ModelPricing;
  reasoningEfforts?: ReasoningEffort[];
  defaultReasoningEffort?: ReasoningEffort;
  status?: 'active' | 'retired';
}
export const LONG_CONTEXT_THRESHOLD = 272_000;
const REASONING: ReasoningEffort[] = ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
const DEEP_REASONING: ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const GPT_5_REASONING: ReasoningEffort[] = ['none', 'low', 'medium', 'high', 'xhigh'];
const cachePricing = (input: number, cachedInput: number, output: number): ModelPricing => ({ input, cachedInput, output, cacheWrite: input * 1.25, cacheWrite12h: input * 2.5 });

export const ALL_MODELS_DB: ModelDef[] = [
  { id:'gpt-6-astra', name:'GPT-6 Astra', ...cachePricing(10,1,50), longContextPricing:cachePricing(20,2,75), maxOutput:128000, context:'1.05M', desc:'Model do najbardziej wymagającej analizy. Temperature niedostępne; poziomy rozumowania od low.', category:'Frontier', tags:['smart','next-gen'], reasoningEfforts:DEEP_REASONING, defaultReasoningEffort:'high' },
  { id:'gpt-6.1-sol', name:'GPT-6.1 Sol', ...cachePricing(2,0.1,10), longContextPricing:cachePricing(4,0.2,15), maxOutput:128000, context:'1.05M', desc:'GPT-6.1 do złożonej redakcji i analizy. Domyślne rozumowanie: medium; temperature niedostępne.', category:'Frontier', tags:['balanced','smart','next-gen'], reasoningEfforts:DEEP_REASONING, defaultReasoningEffort:'medium' },
  { id:'gpt-6.1-terra', name:'GPT-6.1 Terra', ...cachePricing(1,0.05,5), longContextPricing:cachePricing(2,0.1,7.5), maxOutput:128000, context:'1.05M', desc:'GPT-6.1 do pisania i codziennej pracy. Temperature tylko z rozumowaniem none; domyślnie medium.', category:'Zbalansowany', tags:['balanced','fast','next-gen'], reasoningEfforts:REASONING, defaultReasoningEffort:'medium' },
  { id:'gpt-6-luna', name:'GPT-6 Luna', ...cachePricing(0.1,0.01,0.5), longContextPricing:cachePricing(0.2,0.02,0.75), maxOutput:128000, context:'1.05M', desc:'Ekonomiczny model GPT-6. Temperature tylko z rozumowaniem none; domyślnie medium.', category:'Ekonomiczny', tags:['fast','next-gen'], reasoningEfforts:REASONING, defaultReasoningEffort:'medium' },
  { id:'gpt-5.6-sol', name:'GPT-5.6 Sol', ...cachePricing(4,0.4,20), longContextPricing:cachePricing(8,0.8,30), maxOutput:128000, context:'1.05M', desc:'Stawka promocyjna potwierdzona 29.10.2026, dostępna co najmniej do 21.11.2026. Temperature tylko z reasoning none.', category:'Frontier', tags:['smart','next-gen'], reasoningEfforts:REASONING, defaultReasoningEffort:'high' },
  { id:'gpt-5.6-terra', name:'GPT-5.6 Terra', ...cachePricing(2,0.2,12), longContextPricing:cachePricing(4,0.4,18), maxOutput:128000, context:'1.05M', desc:'Zbalansowana jakość i koszt. Temperature tylko z reasoning none.', category:'Zbalansowany', tags:['balanced','next-gen'], reasoningEfforts:REASONING, defaultReasoningEffort:'high' },
  { id:'gpt-5.6-luna', name:'GPT-5.6 Luna', ...cachePricing(0.2,0.02,1.2), longContextPricing:cachePricing(0.4,0.04,1.8), maxOutput:128000, context:'1.05M', desc:'Ekonomiczna seria GPT-5.6. Temperature tylko z reasoning none.', category:'Ekonomiczny', tags:['fast','next-gen'], reasoningEfforts:REASONING, defaultReasoningEffort:'high' },
  { id:'gpt-5.5', name:'GPT-5.5', input:5,cachedInput:0.5,output:30, longContextPricing:{input:10,cachedInput:1,output:45},maxOutput:128000,context:'1.05M',desc:'Domyślny poziom rozumowania API: medium. Temperature tylko z reasoning none.',category:'Frontier',tags:['balanced','smart','next-gen'],reasoningEfforts:GPT_5_REASONING,defaultReasoningEffort:'medium' },
  { id:'gpt-5.4', name:'GPT-5.4',input:2.5,cachedInput:0.25,output:15,longContextPricing:{input:5,cachedInput:0.5,output:22.5},maxOutput:128000,context:'1.05M',desc:'Długi kontekst. Domyślnie API używa reasoning none; temperature dostępne tylko przy none.',category:'Zbalansowany',tags:['balanced','next-gen'],reasoningEfforts:GPT_5_REASONING,defaultReasoningEffort:'high' },
  { id:'gpt-5.2', name:'GPT-5.2',input:1.75,cachedInput:0.175,output:14,maxOutput:128000,context:'400k',desc:'Temperature dostępne przy reasoning none (domyślne ustawienie API).',category:'Poprzednia generacja',tags:['balanced','next-gen'],reasoningEfforts:GPT_5_REASONING,defaultReasoningEffort:'high' },
  { id:'gpt-5.1', name:'GPT-5.1',input:1.25,cachedInput:0.125,output:10,maxOutput:128000,context:'400k',desc:'Temperature dostępne przy reasoning none (domyślne ustawienie API).',category:'Poprzednia generacja',tags:['balanced'],reasoningEfforts:['none','low','medium','high'],defaultReasoningEffort:'high' },
  { id:'gpt-5.2-pro', name:'GPT-5.2 Pro',input:21,cachedInput:21,output:168,maxOutput:128000,context:'400k',desc:'Wyłącznie Responses API. Bez temperature i bez gwarantowanego Structured Outputs. Cena cache: brak udokumentowanego rabatu.',category:'Premium',tags:['smart','next-gen'],reasoningEfforts:['medium','high','xhigh'],defaultReasoningEffort:'medium' },
  { id:'gpt-4o',name:'GPT-4o',input:2.5,cachedInput:1.25,output:10,maxOutput:16384,context:'128k',desc:'Klasyczny model z obsługą temperature.',category:'Standardowy',tags:['balanced'] },
  { id:'gpt-4o-2024-08-06',name:'GPT-4o (2024-08-06)',input:2.5,cachedInput:1.25,output:10,maxOutput:16384,context:'128k',desc:'Przypięta wersja GPT-4o z obsługą temperature.',category:'Standardowy',tags:['balanced'] },
  { id:'gpt-4o-mini',name:'GPT-4o Mini',input:0.15,cachedInput:0.075,output:0.6,maxOutput:16384,context:'128k',desc:'Ekonomiczny model z obsługą temperature.',category:'Ekonomiczny',tags:['fast'] },
  { id:'gpt-5-mini',name:'GPT-5 Mini',input:0.25,cachedInput:0.025,output:2,maxOutput:128000,context:'400k',desc:'Starszy model rozumujący. Nie obsługuje temperature.',category:'Ekonomiczny',tags:['fast'],reasoningEfforts:['low','medium','high'],defaultReasoningEffort:'medium' },
  { id:'o1',name:'o1 (wyłączony)',input:15,cachedInput:7.5,output:60,maxOutput:100000,context:'200k',desc:'Model wyłączony w API; zachowany do odczytu starych sesji i ich kosztów.',category:'Archiwalny',tags:[],status:'retired',reasoningEfforts:['low','medium','high'],defaultReasoningEffort:'high' },
];

/** Models documented as active; account access still depends on the user's project. */
export const MODELS_DB = ALL_MODELS_DB.filter(model => model.status !== 'retired');
export const findModelDef = (modelId: string): ModelDef | undefined => {
  const id = modelId.trim().toLowerCase();
  if (id === 'gpt-5.6') return ALL_MODELS_DB.find(model => model.id === 'gpt-5.6-sol');
  return ALL_MODELS_DB.find(model => model.id === id)
    || [...ALL_MODELS_DB].sort((a,b) => b.id.length-a.id.length).find(model => id.startsWith(model.id+'-') && /^\d{4}-\d{2}-\d{2}$/.test(id.slice(model.id.length+1)));
};
export const getModelDef = (modelId: string): ModelDef => findModelDef(modelId) || MODELS_DB.find(model => model.id === 'gpt-5.6-sol')!;
export const getReasoningEffort = (modelId: string, requestedEffort?: ReasoningEffort): ReasoningEffort | undefined => {
  const model = findModelDef(modelId);
  if (!model?.reasoningEfforts?.length) return undefined;
  return requestedEffort && model.reasoningEfforts.includes(requestedEffort) ? requestedEffort : model.defaultReasoningEffort;
};
/** Estimate, without cache discounts or cache-write/tool fees unavailable in this signature. */
export const calculateSessionCost = (modelId: string, promptTokens: number, completionTokens: number): number => {
  const model = getModelDef(modelId);
  const pricing = promptTokens > LONG_CONTEXT_THRESHOLD && model.longContextPricing ? model.longContextPricing : model;
  return promptTokens / 1_000_000 * pricing.input + completionTokens / 1_000_000 * pricing.output;
};
