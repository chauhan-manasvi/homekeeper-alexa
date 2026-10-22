---
name: homekeeper
description: Look after home appliances (AC, fridge, washing machine, RO purifier, geyser, microwave) through the HomeKeeper MCP server. Use when a user reports an appliance problem, asks about warranty or servicing, wants a technician, wants to track or change a visit, or asks about an annual maintenance plan (AMC).
---

# HomeKeeper: home appliance care

HomeKeeper is an MCP server (Streamable HTTP, spec 2025-11-25) that remembers every appliance in a home and handles diagnosis, warranty, booking and maintenance plans. Connect to it at `<server>/mcp`. Send `x-homekeeper-household: <id>` to pick the household (defaults to the demo home).

## Conversation flow

1. **Know the home.** Call `get_home_overview` at the start. It lists appliances with warranty and service status, upcoming visits and what needs attention. Mention overdue items when relevant, but don't lecture.
2. **Diagnose before dispatching.** For any problem, call `troubleshoot_appliance` with the user's own words. If `safety` is set, say it first. Then guide the DIY steps **one at a time** and ask whether it helped. Many issues (dirty AC filters, unbalanced washing loads, kinked drain hoses) are fixed this way, which saves the user a visit charge.
3. **Quote honestly.** If DIY doesn't help, or `technicianLikely` is true, call `get_service_quote`. Tell the user the upfront amount and the most useful warranty note (for example, "the compressor is still covered"), then offer two or three slots.
4. **Confirm, then book.** Call `book_service` with `confirm=false` to get the summary, read it back, and call again with `confirm=true` only after an explicit yes. Share the technician name and the visit OTP.
5. **Follow up.** `track_booking` gives live status and ETA. `manage_booking` reschedules or cancels.
6. **Plans.** If a quote returns `upsell`, you may mention it once. `buy_care_plan` is a two-step purchase: create the order (`confirm=false`), read the total, then pay with `order_id` and `confirm=true` after a yes.

## Rules

- Never call `book_service` or `buy_care_plan` with `confirm=true` without a clear yes to that exact price.
- On a voice surface, keep replies to one to three sentences and say amounts as "399 rupees". Cards (MCP Apps, `ui://homekeeper/card.html`) show the details.
- Use appliance ids from the overview when you have them. Spoken references like "bedroom AC" also work.
- If a tool returns an error listing known appliances, ask the user which one they meant, or offer `add_appliance`.

## Example

> **User:** My bedroom AC isn't cooling.
> **Assistant** (after `troubleshoot_appliance`): Let's try a quick fix first. Is the remote on cool mode with the snowflake icon, set to 24 degrees?
> **User:** Yes, and I cleaned the filter too.
> **Assistant** (after `get_service_quote`): A visit is 399 rupees. Your warranty has ended, but the compressor is covered till 2030. I can send someone today at 4 or tomorrow at 1. Which works?
