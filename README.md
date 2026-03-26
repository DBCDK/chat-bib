# DBCs NextChat-fork

Chat user interface, deployed to different solutions:

- [ChatBib](https://chatbib.dk)
- [SkoleGPT](https://skolegpt.dk)
- Soon internal chat-documentation tool

It is a fork of one of the most popular open source chat user interfaces [NextChat](https://github.com/ChatGPTNextWeb/NextChat) as

- development on original repository seem to have slowed down / halted
- we have a different goal: custom chat user interfaces on top of a single llm-endpoint, rather than a general chat ui supporting tons of different providers.

Current version is very specific to the ChatBib and SkoleGPT, but the more different deployments we make, the more general it will become.

## Customisations

Deployments can be customised with different `NEXT_PUBLIC_`-environment-variables:

- `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_KEY`, and `NEXT_PUBLIC_CUSTOM_MODELS` configures the OpenAI-compatible-api for llm-backend and available models. If not set, it will use internal DBC services. When these environment variables are set, containerised diallowing everything except incoming connections, as the client connects directly to the LLM-server/gateway.
- `NEXT_PUBLIC_CHAT_DISCLAIMER="some disclaimer` adds a disclaimer below the chat input.
- `NEXT_PUBLIC_APP_TITLE`, `NEXT_PUBLIC_APP_TAGLINE`, and `NEXT_PUBLIC_APP_LOGO` for branding.
- `NEXT_PUBLIC_CONTAINER_CSS_CLASS` sets the root-css-class.
- `NEXT_PUBLIC_DISABLE_GOOGLE_FONTS` disables google fonts, as SkoleGPT is more strict about tracking.
- `NEXT_PUBLIC_HOMEPAGE_IS_MASKLIST` makes shows mask-list by default
- Styles are selected at runtime via `env.STYLE` (from app settings). Build auto-generates runtime stylesheets from all `app/styles/globals-*.scss` files into matching `public/styles/globals-*.css` files, and the active app loads `/styles/globals-<style>.css` plus assets from `public/<style>/` (e.g. `site.webmanifest`, `favicon.ico`, `prompts.json`).
- `NEXT_PUBLIC_APP_SYSTEM_PROMPT_IN_SIDEBAR` shows the first systemprompt of the current mask in the sidebar
- `NEXT_PUBLIC_DISABLE_MODELS` disable default models
- `NEXT_PUBLIC_INJECT_ANALYTICS="<script> ..."` overrides hardcoded matomo+cookie-prompt
- `NEXT_PUBLIC_LOCALE="skolegpt"` uses SkoleGPT "translation"/messages in UI. 
- `NEXT_PUBLIC_DISABLE_FEEDBACK` hides the feedback button.
- `NEXT_PUBLIC_DEFAULT_MASK` chooses the default masks for new chats
- `NEXT_PUBLIC_USE_MASK_AS_SESSION_NAME`.
- `NEXT_PUBLIC_DISABLE_BOT_HELLO` removes the default hardcoded message in the chat.
- `NEXT_PUBLIC_DEFAULT_MESSAGE_COUNT` sets the default message count for masks
- `NEXT_PUBLIC_DEFAULT_MODEL` sets the default model
- `NEXT_PUBLIC_SHOW_SETTINGS` enables settings menu
- `NEXT_PUBLIC_DISABLE_MULTI_LLM` disable the ChatBib-specific multi-llm UI