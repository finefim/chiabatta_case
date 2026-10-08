# Leo · context assembled on every run

| Run type | Context | Tokens (typical) |
|---|---|---|
| New order | system prompt, the order | 6–9k |
| 30-minute check | system prompt, every open supplier order with its full history | 15k + ~38 per open order |
| Inbox email | system prompt, the email | 4–7k |
| Mention in channel | system prompt, the last 200 channel messages | 20–26k |

Tool results are appended raw. An Ortensi order response is kept as a whole: `http`, `esito`, `stato`, `messaggio`.

Each 30-minute run starts from the system prompt and the inputs above.
