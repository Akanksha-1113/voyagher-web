# VoyagHER

A safety companion for women travelling solo in Southeast Asia. You ask a question, VoyagHER finds the relevant sections of a curated safety knowledge base (RAG), and an open-source LLM answers using them.

Originally built as a team project at Kode With Klossy (Gradio on Hugging Face Spaces). This version is a standalone website that also installs on phones as an app.

## What's inside

| File | What it does |
|---|---|
| `public/index.html` | The chat website (mobile-first, light and dark mode) |
| `public/manifest.webmanifest`, `public/sw.js`, `public/icon.svg` | Make it installable as a phone app (PWA); emergency numbers work offline |
| `api/chat.js` | Server function: retrieves knowledge, calls the LLM, streams the reply |
| `lib/retrieve.js` | BM25 keyword retrieval over the knowledge base (no ML libraries needed) |
| `knowledgebase.txt` | The safety knowledge. Edit this to improve answers. Sections are separated by blank lines |

The API key stays on the server and is never sent to the browser.

## Launch it (free, about 30 minutes)

1. **Get a Groq API key.** Sign up at console.groq.com, then go to API Keys and create one. Copy it somewhere safe.
2. **Put the code on GitHub.** Create a new repository called `voyagher`, then use "uploading an existing file" and drag in everything from this folder (keep the `api`, `lib` and `public` folders).
3. **Deploy on Vercel.** Sign up at vercel.com with your GitHub account. Click Add New, then Project, and import `voyagher`. Leave Framework as "Other".
4. **Add your key.** Before clicking Deploy, open Environment Variables and add `GROQ_API_KEY` with your key as the value. Then click Deploy.
5. **Open your link** (something like `voyagher.vercel.app`) and ask it a question.

To install on a phone: open the link, then choose "Add to Home Screen" (Safari share menu, or the Chrome menu).

## Before sharing widely

- **Check the emergency numbers** in `knowledgebase.txt` and `public/index.html` against official sources.
- Groq's free tier has rate limits. If many people use it at once, some will see "very busy". That is a good problem to have; upgrade then.
- The default model is `openai/gpt-oss-120b`, with `openai/gpt-oss-20b` as backup. To use another Groq model, add a `GROQ_MODEL` environment variable in Vercel.

## Updating

Edit a file on GitHub and commit. Vercel redeploys automatically within a minute.
