## Agent Notes: DBC LLM Endpoint

Short: How agents call the DBC OpenAI-compatible chat completions endpoint used by Chatbib.

### Setup
- Endpoint: `{DBC_LLM_ENDPOINT}/v1/chat/completions`
- Auth: HTTP header `Authorization: Bearer {DBC_LLM_TOKEN}`
- Models: Accepts only names from `DBC_LLM_ENDPOINT_MODELS` in `app/constant.ts` (currently `chatbib`, `gemma3-12b`, `skolegpt`)
- Model selection: For now always send `"chatbib"`. Future: allow overriding model name via the LLM client input.

### Request
- OpenAI-compatible JSON: `messages` (array of `{role, content}`), `model`, `temperature`, `top_p`, `max_tokens`, `presence_penalty`, `frequency_penalty`, `stream: true`.

### Streaming Response
- Parse SSE JSON lines; accumulate `choices[0].delta.content`.

### File References
- `app/dbc/llmClient.ts` — endpoint call and streaming handling
- `app/config/server.ts` — reads `DBC_LLM_ENDPOINT`, `DBC_LLM_TOKEN`
- `app/constant.ts` — `DBC_LLM_ENDPOINT_MODELS` (allowed models)
- `app/dbc/index.ts` — `MODEL_NAMES` are frontend "agents", not LLM model names


### Multi-Agent Chat Mode

- **Trigger**: New chat screen → click the "Multi-llm" action button (starts multi-agent mode on a fresh parent session).
- **Behavior**: The chat view splits into multiple panes (up to 5), one per eligible persona. Each child pane keeps its own `id`, message history and mask, and uses endpoint `llmModel = "chatbib"`. A single shared input fans out to all child panes; responses stream independently per pane.
- **Session structure**:
  - Parent session holds `multiLlmChildren` with one `ChatSession` per persona.
  - Parent session has `multiMode: 'agents'` to select persona header rendering.
  - Children store their mask/persona and `llmModel`.
- **Inputs**:
  - A shared input at the bottom sends the same user message to all child panes.
  - Each pane also has its own input and send button directly below its message list; these send only to that pane.
  - Enter/submit behavior follows the global submit key configuration; the pane send button performs the same action.
- **Persona selection**:
  - Built from `PERSONAS` in `app/personas.tsx` where `multiAgentEligible === true`.
  - Hard cap of 5 panes (first 5 eligible personas by source order).
  - `showInNewChat: false` personas are hidden on the new-chat selection screen but still included in multi-agent (e.g., SimpleSearch, ComplexSearch).
- **UI/Rendering**:
  - Reuses the same grid as multi‑LLM (`multi-llm-grid`).
  - Pane header shows the persona name in agent mode, and the endpoint model name in multi‑LLM mode.
- **Endpoint selection**: Agent mode always sends `llmModel = "chatbib"` to the DBC endpoint; the high‑level agent model (e.g., `dbc-simple-search`, `dbc-complex-search`) comes from the child's mask.

#### File References
- `app/components/chat.tsx` — shared multi‑pane grid; header switches by `session.multiMode`
- `app/components/new-chat.tsx` — button starts a fresh session and calls `startMultiAgents()`
- `app/store/chat.ts` — `startMultiAgents`, input fan‑out across `multiLlmChildren`, `multiMode` flag
- `app/personas.tsx` — personas with `multiAgentEligible`, `showInNewChat`, and masks for SimpleSearch/ComplexSearch
- `app/client/api.ts` / `app/client/platforms/dbc.ts` — forwards `llmModel` and conversation id
- `app/dbc/llmClient.ts` — maps `parameters.llmModel` to endpoint `model` and includes `top_p`
- `app/store/chat.ts` — `onUserInputToChild(childId, content, images?)` sends to a single pane
- `app/components/chat.module.scss` — per‑pane input styles (`multi-llm-input`)


### Multi-LLM Chat Mode

- **Trigger**: Click the "Multi-llm" button in the chat top bar on an empty chat session.
- **Behavior**: The chat view splits into three panes, one per endpoint model from `DBC_LLM_ENDPOINT_MODELS` (`chatbib`, `gemma3-12b`, `skolegpt`). A single shared input sends the same user message to all panes; responses stream independently per pane.
- **Dynamic panes**: The panes are built dynamically from `DBC_LLM_ENDPOINT_MODELS`; adding a model there adds a pane automatically.
- **Session structure**: The parent session holds three child sessions in `multiLlmChildren`. Each child has its own `id`, message history and `llmModel`. The sidebar shows the parent only; child histories stay isolated.
- **Persona/agent continuity**: The high-level agent/model (e.g. Bibliotek.dk / `dbc-simple-search`) continues to execute as usual per pane; only the endpoint model is chosen via `LLMParameters.llmModel`.
- **Endpoint selection**: `llmClient.ts` selects the remote endpoint model from `DBC_LLM_ENDPOINT_MODELS` based on `parameters.llmModel`, defaulting to `"chatbib"`.
- **Streaming**: Uses the existing `/api/dbc/generate_stream` client path; panes render token streams as they arrive.
- **Inputs**:
  - A shared input at the bottom fans out a single user message to all LLM panes.
  - Each pane has its own input and send button under its messages; sending here targets only that pane’s conversation.
  - Keyboard submit mirrors the global submit key; the send button triggers the same.

#### File References
- `app/components/chat.tsx` — Multi-llm button, 3-pane rendering, shared input dispatch
- `app/components/chat.module.scss` — grid layout, pane borders/radius
- `app/store/chat.ts` — `multiLlmChildren`, `startMultiLlm`, `onUserInputSmart`
- `app/client/api.ts` — `LLMConfig.llmModel`, `ChatOptions.conversationIdOverride`
- `app/client/platforms/dbc.ts` — forwards `llmModel` and conversation id
- `app/dbc/llmClient.ts` — maps `parameters.llmModel` to endpoint `model`
- `app/constant.ts` — `DBC_LLM_ENDPOINT_MODELS` (allowed endpoint models)
- `app/store/chat.ts` — `onUserInputToChild(childId, content, images?)` for targeted send
- `app/components/chat.module.scss` — per‑pane input styles (`multi-llm-input`)
