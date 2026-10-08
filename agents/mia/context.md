# Mia · context assembled on every run

| Block | Tokens (typical) | Where it comes from |
|---|---|---|
| System prompt | 1,850 | `prompt.md` |
| `{{POLICIES}}` | 9,600 | the whole of `docs/policies.md` plus old versions pasted below it "for reference" |
| `{{PRODUCT_CATALOGUE}}` | 38,400 | every SKU with description, material and fit, including out-of-stock and discontinued ones |
| `{{CUSTOMER_HISTORY}}` | 1,500–9,000 | every order, message and agent action for the customer, oldest first |
| Conversation so far | 200–2,000 | helpdesk |
| Tool results | varies | raw JSON appended after each call |
