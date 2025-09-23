# Composio: Must‑Have Toolkit Support

Updated: 2025-09-20

This document tracks the must‑have integrations Formlink supports via Composio. The app no longer relies on `ACTIONS_COMPOSIO_TOOLKITS`; support is curated in code and enabled behind `ACTIONS_COMPOSIO_ENABLED=true` with a valid `COMPOSIO_API_KEY`.

## Supported Now (curated)

- slack (`slack`) — channel/DM notifications
- linear (`linear`) — issue creation/updates
- hubspot (`hubspot`) — contacts, deals, tickets
- salesforce (`salesforce`) — leads and opportunity sync
- apollo (`apollo`) — sequences, enrichment
- zoominfo (`zoominfo`) — contact/company enrichment
- notion (`notion`) — page content and comments
- airtable (`airtable`) — base/record operations
- google sheets (`googlesheets`) — sheet/row operations
- google bigquery (`googlebigquery`) — query execution
- mailchimp (`mailchimp`) — campaigns, audiences
- customer.io (`customerio`) — broadcasts, events
- microsoft teams (`microsoft_teams`) — channel messages
- asana (`asana`) — projects/tasks
- trello (`trello`) — boards/cards
- monday (`monday`) — boards/items
- jira (`jira`) — issues/comments
- gong (`gong`) — calls/tasks
- zoom (`zoom`) — meetings/webinars
- google ads (`googleads`) — audiences/campaign data
- meta ads (`metaads`) — audiences/campaign data
- calendly (`calendly`) — scheduling links/events
- surveymonkey (`survey_monkey`) — surveys/collectors

Notes

- Each toolkit expects an auth config id (env: `COMPOSIO_<TOOLKIT>_AUTH_CONFIG_ID`) when applicable. See `apps/formcraft/app/lib/actions/catalog.ts` for the authoritative list and scopes.
- Curated end‑to‑end actions live in `apps/formcraft/app/lib/actions/registry.ts`.

## Not Yet Available in Composio

- marketo — missing toolkit
- pardot — missing toolkit
- outreach — missing toolkit
- salesloft — missing toolkit
- chorus — missing toolkit
- typeform — missing toolkit
- chilipiper — missing toolkit

## Operational Flags

- `ACTIONS_COMPOSIO_ENABLED=true` to turn on Composio features
- `COMPOSIO_API_KEY` must be set (fail‑fast otherwise)
- Optional: `COMPOSIO_BASE_URL` for non‑default API base

## TODOs

- TODO: Monitor Composio catalog for the missing toolkits above and enable once they land (scripts/dump-composio-catalog.ts).
- TODO: Add curated actions for any newly supported toolkits as they become available (apps/formcraft/app/lib/actions/registry.ts).
- TODO: Verify auth scopes by toolkit during OAuth/link flows and trim where possible (apps/formcraft/app/lib/actions/catalog.ts).
