# Friction log

Problems we ran into while building HomeKeeper for the Build, Ship, Shape: Amazon Developer Hackathon (Alexa+ track), with the workaround we used and a suggestion for each.

**1. MCP Apps helpers don't work with the stable SDK**
- Task: attach an MCP Apps card to tools using the official helper package.
- Steps: installed `@modelcontextprotocol/ext-apps@2.0.3` next to `@modelcontextprotocol/sdk@1.32.1` and looked for `registerAppTool`.
- Expected: helpers that work with the current stable SDK.
- Actual: the helpers' types import from `@modelcontextprotocol/server` (SDK v2), not from the 1.x SDK.
- Severity: medium.
- Workaround: removed the package and set `_meta: { ui: { resourceUri } }` and the `text/html;profile=mcp-app` MIME type by hand.
- Suggestion: publish a 1.x-compatible helper, or document the raw `_meta` shape prominently for 1.x users.

**2. No way to test an MCP server against real Alexa+**
- Task: try HomeKeeper on an actual Alexa+ device or a test console.
- Steps: read the hackathon resources and the Alexa+ track description.
- Expected: a developer test console or preview access for our own account.
- Actual: MCP integrations are limited to brands in preview, so the only option was a simulated experience.
- Severity: high (it shapes the whole project).
- Workaround: built an Echo Show style web simulator that drives the same MCP server.
- Suggestion: a public Alexa+ MCP test console, even text-only, so developers can validate tool descriptions and responses on the real model.

**3. Unclear which card features Alexa+ supports**
- Task: design visual responses for Echo Show.
- Steps: looked for Alexa+ documentation on MCP Apps or card rendering.
- Expected: a list of supported MCP Apps capabilities and screen sizes for Echo Show devices.
- Actual: no Alexa-specific guidance, so we had to guess the layout and size.
- Severity: medium.
- Workaround: built a responsive card that follows the generic MCP Apps handshake.
- Suggestion: publish the supported MCP Apps subset, viewport sizes and theming for Echo Show.

**4. AWS credits ran out before the deadline**
- Task: get AWS credits to run the agent on Amazon Bedrock for the AWS Builder mini-challenge.
- Steps: opened the hackathon resources page.
- Expected: a credit request form.
- Actual: "out of credit codes and no longer accepting credit requests" (7 Oct update).
- Severity: low to medium (it costs individual developers money).
- Workaround: switched the demo agent to a free model provider (Groq's free tier, with local Ollama as a fallback), and didn't enter the AWS Builder mini-challenge.
- Suggestion: reserve a small pool of credits for late registrants, or point to the Bedrock free trial path.
