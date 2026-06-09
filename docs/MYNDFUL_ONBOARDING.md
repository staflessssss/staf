# MYNDFUL Films onboarding

Target tenant:

- Tenant ID: `cmq6kgx1d0000ux1cyxs0ggl4`
- Tenant slug: `myndful-films`
- Tenant timezone: `America/New_York`
- Production URL: `https://behalfy.io`

## 1. Create or reuse the customer invite

Run locally with production database credentials:

```powershell
$env:CUSTOMER_EMAIL="<customer-email>"
npm run prepare:myndful-onboarding
```

Send the returned invite URL to the customer. The invite expires after seven days and can be
accepted only once.

## 2. Meta tester access

In Meta Developers, add the customer's professional Instagram account as an Instagram tester for
the Behalfy app. The customer must accept the tester invitation while logged into that Instagram
account.

This is a manual Meta Developers step. It is temporary until the app passes Meta App Review.

## 3. Customer connections

The customer signs into their Behalfy cabinet and connects:

1. Instagram.
2. Google account. This creates Gmail, Google Calendar, Google Sheets, and Google Drive connections.
3. Telegram owner handoff bot, if owner escalation should be live at launch.

Before cloning agents:

- Share `Myndful Films Bookings` with the exact Google account connected in Behalfy.
- Ensure the connected Google account can read the configured `price.png` Google Drive file.
- Ensure the connected calendar is the calendar that should receive consultation bookings.

## 4. Readiness check

```powershell
npm run prepare:myndful-onboarding
```

Continue only when `readyToClone` is `true`.

## 5. Copy both agents

Dry run:

```powershell
$env:TARGET_TENANT_ID="cmq6kgx1d0000ux1cyxs0ggl4"
npm run clone:agents-to-tenant
```

Apply:

```powershell
$env:TARGET_TENANT_ID="cmq6kgx1d0000ux1cyxs0ggl4"
$env:APPLY="1"
$env:CONFIRM_SHARED_RESOURCES="1"
$env:TARGET_SPREADSHEET_ID="<customer-spreadsheet-id>"
$env:TARGET_CALENDAR_ID="<customer-calendar-id-or-email>"
npm run clone:agents-to-tenant
```

The command copies both MYNDFUL agents as drafts, remaps their Google integration IDs to the
customer’s connections, and removes source deployment/webhook state.

The command refuses to replace existing agents. Use `FORCE_REPLACE=1` only after reviewing the
dry-run output and intentionally approving replacement.

## 6. Review and launch

In the admin workspace:

1. Open both copied agents and verify channel, integrations, Functions, Knowledge, Prompting,
   Playbook, Messages, and Control.
2. Verify the Sheets function points at the expected spreadsheet and tabs.
3. Verify the Calendar functions use the customer's booking calendar and timezone.
4. Verify the price guide file is accessible.
5. Test both agents in test chat.
6. Deploy Gmail Agent, then Instagram Agent.
7. Send one real Gmail message and one real Instagram DM from external accounts.
8. Verify dialogs, lead details, tool calls, calendar invite, and Telegram owner handoff.
