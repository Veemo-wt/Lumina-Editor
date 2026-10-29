import { findModelDef } from '../utils/models';

interface CompletionClient {
  chat: { completions: { create: (params: any) => PromiseLike<any> } };
  post: (path: string, options: any) => PromiseLike<any>;
}
type RequestParams = Record<string, any>;
const snapshotMatches = (id: string, base: string) => id === base || (id.startsWith(base+'-') && /^\d{4}-\d{2}-\d{2}$/.test(id.slice(base.length+1)));

/** Use provider defaults here, independently of the Scanner's UI default. */
export const supportsSampling = (modelId: string, effort?: string): boolean => {
  const id = modelId.trim().toLowerCase();
  if (/^gpt-4(?:o|\.1)(?:-|$)/.test(id) && !id.includes('search')) return true;
  if (['gpt-5.1','gpt-5.2','gpt-5.4'].some(base => snapshotMatches(id,base))) return (effort ?? 'none') === 'none';
  if (['gpt-5.5','gpt-5.6','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-6-sol','gpt-6.1-terra','gpt-6-luna'].some(base => snapshotMatches(id,base))) return effort === 'none';
  // Astra, Sol 6.1, Pro, o-series, GPT-5/mini/nano and unverified IDs: omit sampling.
  return false;
};

export const normalizeModelRequest = (params: RequestParams): RequestParams => {
  const request: RequestParams = { ...params, model: String(params.model || '').trim() };
  const id = request.model.toLowerCase();
  const model = findModelDef(id);
  if (model?.status === 'retired') throw new Error(`Model ${model.id} został wyłączony w API. Wybierz dostępny model w konfiguracji.`);
  if (request.reasoning_effort && model?.reasoningEfforts && !model.reasoningEfforts.includes(request.reasoning_effort)) {
    throw new Error(`Model ${id} nie obsługuje poziomu rozumowania ${request.reasoning_effort}. Dostępne: ${model.reasoningEfforts.join(', ')}.`);
  }
  if (!supportsSampling(id,request.reasoning_effort)) {
    for (const key of ['temperature','top_p','logprobs','top_logprobs']) delete request[key];
  }
  if (/^(gpt-[56](?:[.-]|$)|o[1-9](?:-|$))/.test(id)) {
    if (request.max_tokens !== undefined && request.max_completion_tokens === undefined) request.max_completion_tokens = request.max_tokens;
    delete request.max_tokens;
  }
  if (model && request.max_completion_tokens !== undefined) request.max_completion_tokens = Math.min(request.max_completion_tokens,model.maxOutput);
  return request;
};

const isSamplingError = (error: any) => {
  if (error?.status !== 400) return false;
  const message = String(error?.message || error?.error?.message || '').toLowerCase();
  const param = String(error?.param || error?.error?.param || '').toLowerCase();
  return ['temperature','top_p','logprobs','top_logprobs'].some(key => param === key || message.includes(`'${key}'`) || message.includes(`"${key}"`))
    && /unsupported|not support|only.*default/.test(message);
};

const proCompletion = async (client: CompletionClient, request: RequestParams) => {
  if (request.response_format?.type === 'json_schema') throw new Error('GPT-5.2 Pro nie obsługuje Structured Outputs. Wybierz model obsługujący schemat JSON.');
  const body: RequestParams = { model:request.model, input:request.messages, store:false };
  if (request.reasoning_effort) body.reasoning = { effort:request.reasoning_effort };
  const limit = request.max_completion_tokens ?? request.max_tokens;
  if (limit !== undefined) body.max_output_tokens = limit;
  // Pro does not support Structured Outputs: retain the JSON prompt and validate locally.
  const response = await client.post('/responses',{body});
  if (response.error || response.status === 'failed') throw new Error(response.error?.message || 'Model nie ukończył odpowiedzi.');
  if (response.status === 'in_progress' || response.status === 'queued') throw new Error('Model zwrócił odpowiedź asynchroniczną bez ukończonego tekstu.');
  const messages = (response.output || []).filter((item: any) => item.type === 'message');
  const content = messages.flatMap((item: any) => item.content || []);
  const refusal = content.find((part: any) => part.type === 'refusal');
  if (refusal) throw new Error(refusal.refusal || 'Model odmówił przygotowania odpowiedzi.');
  let text = content.filter((part: any) => part.type === 'output_text').map((part: any) => part.text).join('') || response.output_text || '';
  const truncated = response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens';
  if (response.status === 'incomplete' && !truncated) throw new Error('Model nie ukończył odpowiedzi: '+(response.incomplete_details?.reason || 'nieznana przyczyna'));
  if (request.response_format?.type === 'json_object' && truncated) throw new Error('GPT-5.2 Pro osiągnął limit tokenów przed ukończeniem JSON. Zmniejsz fragment tekstu i spróbuj ponownie.');
  if (request.response_format?.type === 'json_object' && !truncated) {
    text = text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    try { const value = JSON.parse(text); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); }
    catch { throw new Error('GPT-5.2 Pro nie zwrócił poprawnego obiektu JSON. Spróbuj ponownie albo wybierz model obsługujący Structured Outputs.'); }
  }
  return { choices:[{message:{content:text},finish_reason:truncated?'length':'stop'}], usage:{ prompt_tokens:response.usage?.input_tokens || 0, completion_tokens:response.usage?.output_tokens || 0, total_tokens:response.usage?.total_tokens || 0 } };
};

/** One compatibility boundary for all Lumina text-generation requests. */
export const createModelCompletion = async (client: CompletionClient, params: RequestParams): Promise<any> => {
  const request = normalizeModelRequest(params);
  if (snapshotMatches(request.model.toLowerCase(),'gpt-5.2-pro')) return proCompletion(client,request);
  try { return await client.chat.completions.create(request); }
  catch (error) {
    // An explicit provider rejection can refine a custom/new model's capabilities.
    if (!isSamplingError(error) || !['temperature','top_p','logprobs','top_logprobs'].some(key => key in request)) throw error;
    const fallback = {...request};
    for (const key of ['temperature','top_p','logprobs','top_logprobs']) delete fallback[key];
    return client.chat.completions.create(fallback);
  }
};
