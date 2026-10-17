# Fix Google Apps Script deployment (Credlock Portal)

## Why it fails now

Opening your current URL returns an **HTML login/error page**, not JSON.
The portal needs JSON like: `{"ok":true,"service":"Credlock Portal API"}`

Common causes:
- Who has access is not **Anyone**
- Old deployment not updated after code changes
- Using `/dev` URL instead of `/exec`
- Script not bound to the correct spreadsheet

## Step-by-step fix (5 minutes)

### 1. Open Apps Script from the Sheet
1. Open: https://docs.google.com/spreadsheets/d/1qOySvKFNS5kkMGjHoyr51-qJJ3bQavTzk83k5owZbIo/edit
2. Menu: **Extensions → Apps Script**

### 2. Paste Code.gs
1. In the left file list, open `Code.gs` (or create it)
2. Select all → Delete
3. Paste the full contents of **Code.gs** from this repo
4. **Save** (disk icon or Ctrl+S)

### 3. Authorize once
1. Top function dropdown → choose **`setup_`**
2. Click **Run**
3. Click **Review permissions** → choose your Google account
4. Advanced → Go to project (unsafe) → **Allow**
5. Execution log should show success (tickets/users counts)

### 4. Create a NEW Web App deployment
1. Click **Deploy** → **New deployment**
2. Gear icon ⚙️ → select **Web app**
3. Settings:
   - **Description:** `Credlock Portal API v3.4`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`  ← critical
4. Click **Deploy**
5. **Copy** the Web app URL (ends with `/exec`)

### 5. Test in browser
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=ping
```

**Success:** `{"ok":true,"service":"Credlock Portal API","version":"3.4",...}`

**Failure:** Google HTML / sign-in page → create another **New deployment** with Anyone.

### 6. Connect the portal
1. Open https://credlock-tech-support.netlify.app/
2. Sign in as Team Lead
3. **Settings** → paste the `/exec` URL → **Save & connect**
4. Click **Sync**
5. Status should show **Sheets live**

## Test actions

| URL | Expected |
|-----|----------|
| `?action=ping` | ok: true |
| `?action=listTickets` | tickets array |
| `?action=listUsers` | users array |
| `?action=sync` | tickets + users |
