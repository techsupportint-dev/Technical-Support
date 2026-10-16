# Connect live Google Sheet database

**Spreadsheet:** https://docs.google.com/spreadsheets/d/1qOySvKFNS5kkMGjHoyr51-qJJ3bQavTzk83k5owZbIo/edit

## 1. Install backend code

1. Open the spreadsheet → **Extensions → Apps Script**
2. Create file `PortalBackend.gs` (or replace Code.gs)
3. Paste contents of **PortalBackend.gs** from this repo (or from the chat artifacts)
4. Save

## 2. Run setup once

1. Select function `setupPortalSheets` → Run
2. Authorize with the Google account that owns the sheet
3. Confirm sheets: Tickets, Users, ActivityLog, Officers, Config, Rota

## 3. Deploy Web App

1. **Deploy → New deployment → Web app**
2. Execute as: **Me**
3. Who has access: **Anyone**
4. Deploy → copy the `/exec` URL

## 4. Portal Settings

1. Open https://credlock-tech-support.netlify.app/
2. Sign in as Team Lead (`techsupport.int@gmail.com` / `6424`)
3. **Settings** → paste Web App URL → **Save & connect**
4. Status should show **Sheets mode**

## 5. Registration approval

- Officers use **Register** on the login page
- Saved locally and POSTed to sheet `Users` (status = pending)
- Team Lead → **Approvals** → Approve / Reject

## 6. Bulk upload

Settings → Tickets CSV or Kavro CSV. Duplicates by Ticket ID / IMEI are updated.

## Why API returned HTML before

Old deployment was not serving JSON. Redeploy with **Anyone** after pasting PortalBackend.gs.
