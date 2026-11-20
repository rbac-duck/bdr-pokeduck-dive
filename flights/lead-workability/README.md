# bdr_lead_workability

Scores every inbound MQL+ lead for BDR workability, hourly (`7 * * * *` UTC), into
`bdr_terminal_gamified.main.lead_workability`. The BDR Pokeduck dive LEFT JOINs that table on `contact_id`
(◇ ALL LEADS tab, and the Workability filter and badges on the Inbound tab). Leads not scored yet show as "Pending".

Flight id `4af76f58-f05b-404d-8f11-ab1f6b393b30`. Deploy changes with `motherduck flight push flights/lead-workability`
(CI only deploys dives).

## What counts as a lead
- `mdw.hubspot.contacts` with `lifecyclestage NOT IN ('lead','')` and not null, `hs_marketable_status = 'true'`, and an email not on `@motherduck.com`. This matches the Marketing Dashboard's MQL+ count.
- Inbound only, meaning none of these apply:
  - an Apollo contact;
  - on an Outbound-source deal;
  - `calc_first_conversion = 'Outbound / Prospecting'`.
- Lead date = `createdate`, in UTC.

## Rules (first match wins)
| reason | severity | rule |
|---|---|---|
| AGENT_OR_RELAY_EMAIL | red | email domain in `main.relay_domains` (edit that table to change the list) |
| JOINED_EXISTING_ORG | red | the earliest MotherDuck user for the email did not create their org |
| NEW_TEAM_AT_PAYING_CUSTOMER | red | created their org, but an older org on the same work domain has AWR > 0 |
| NON_TECHNICAL | red | role = non_technical |
| INSUFFICIENT_INFO | red | role = unknown |
| TECH_NO_EMPLOYER | amber | role = tech_no_company |
| NO_MD_USER_MATCH | amber | the role looks fine, but no MotherDuck user has this email |
| WORKABLE | none | role = icp or tech_at_company |

Roles come from `prompt_jev`. A lead is only re-scored when its prompt input (title, company, email domain, LinkedIn found)
or email changes, or when `RULES_VERSION` goes up. This keeps labels stable between runs. Later runs only classify new or changed leads, so they finish in seconds.

The latest BDR override wins over the model's label. It is a `role_override` event in `main.touch_events`, written through
the log-action flight, so only the contact's BDR owner can set it. The dive recomputes the reason from the stored facts
and the override, so a change shows immediately. Keep `wkReason()` in the dive in step with the CASE in `main.py`.

Tags, which are not reasons:
- `agent_harness`: the first MCP session came from the agent-harness/0.1.0 ai-sdk client within a day of signup.
- `batch_signup`: 5 or more users on one domain signed up within ±10 minutes.
- `company_on_md`: another free org exists on the same domain.

## Config
- `LOOKBACK_DAYS` (95): leads created in this window get fresh facts each run.
- `MAX_SCORE` (30000): the most leads classified per run, newest first.
- `BATCH_SIZE` (2000): leads per prompt_jev batch.
