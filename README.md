# SkoleGPT / ChatBib – DBCs NextChat-fork

Chat-bib is a fork of [NextChat](https://github.com/ChatGPTNextWeb/NextChat), one of the most popular AI-Chat frontends.

It is used for 
- https://chat.skolegpt.dk
- https://chatbib.dk
- Internal chat-documentation tool

<small>**Why fork?** Development of NextChat has halted, and misses security fixes. And our use case is also slightly different:  we use it for deploying different customized chat solutions on top of a single openai-api-compatible inference endpoint, where the original NextChat was more targeted towards being a tool for using different inference endpoints.</small>

Current version is very specific to the ChatBib and SkoleGPT, but the more different deployments we make, the more general it will become.

## Getting started developing

Create a new `.env.local` like:

```bash
APP=skolegpt
LLMTOKEN=...
```

Then run:

```bash
npm install
npm run build:styles
npm run dev
```

Now the development server starts, and the app can be opened <http://localhost:3000> in your browser, and will update as the source changes.

The development server is slightly different from deployment. To run the deployed version do:

```bash
npm run build
npm start
```