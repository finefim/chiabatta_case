# How the agents are built today

Each agent has three files:

- `prompt.md`: the system prompt exactly as deployed
- `context.md`: what gets put into the model's context on every run, with token counts
- `tools.json`: the tools the model can call, as the model sees them

**Runtime (all agents):** a generic agent loop from an off-the-shelf framework. On each trigger it builds the context, calls the model, runs whatever tool the model picks, appends the raw tool result and repeats until the model says it's done, for at most 25 steps. There is no code around the model beyond this loop: every rule lives in the prompt. Nothing persists between runs except what's in the database tables.

Prompts are edited in the framework's web console. There is no version history and no test set; changes go live on save.

| Agent | Model | Trigger | Cost, last 30 days |
|---|---|---|---|
| Mia | model-L | every customer message; every human decision on her actions | see `agent_runs` |
| Leo | model-M / model-L | every new order; every 30 minutes; every inbox email; mentions | |
| Tina | model-L | every 15 minutes | |
| Paolo | model-M / model-L | Kade's 05:00 file; invoices; payment emails; nightly 02:00 | |
| Nora | model-L | hourly; mentions | |
