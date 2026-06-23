# Important Dates Sync

A Google Apps Script that syncs birthdays and important dates between a Google Sheet and Google Contacts. Bidirectional — push from sheet to contacts, pull from contacts to sheet, and discover contacts with dates you haven't tracked yet. Everything runs through a sidebar panel inside Google Sheets. No extra tools, no OAuth dance, no local setup.

---

## What it does

- Matches your sheet rows to Google Contacts by email, exact name, nickname (Jen → Jennifer, Joe → Joseph, etc.), or partial name
- Pushes dates from your sheet to matching contacts
- Imports contacts that already have dates in Google Contacts into your sheet
- Detects conflicts (birthday mismatch, name differences) and surfaces them for human review
- Lets you untrack or ignore contacts you don't want to follow

**This is a date tracker, not a contact manager.** It never changes a contact's name. To fix a name, edit it in Google Contacts directly.

---

## What it will and won't touch

**Will:**
- Add or update dates on existing Google Contacts
- Add email to a contact that doesn't have one
- Create new contacts (only when you click "Create Contact")
- Pull name/email from contact to sheet (only on "Pull from Contact")
- Import contacts with dates into the sheet (only on "Import to Sheet")
- Clear dates from contacts (only when you click "Untrack")
- Delete sheet rows (only on "Untrack → All dates")

**Won't:**
- Delete any Google Contact (Rollback only removes contacts this script created in the current session)
- Modify birthdays sourced from a person's Google profile (read-only)
- Touch anything you haven't explicitly clicked a button for

---

## Setup (one-time, ~5 minutes)

1. Open a Google Sheet — either an existing one with contacts data, or a blank one
2. **Extensions → Apps Script**
3. **Name the project** — click "Untitled project" in the top-left and rename it to `Important Dates Sync`. This name shows in the Google OAuth authorization prompt; without it you'll see "Untitled project" which looks untrustworthy
4. Paste the contents of `Code.gs` into the editor, replacing all default content
5. **Enable the People API:**
   Left sidebar → Services `(+)` → find "People API" → Add
   *(shows up as "Peopleapi" in the list — that's the one)*
6. Save — `Ctrl+S` or click "Save to Drive"
7. Go back to your Sheet and **refresh the page** (`F5` / `⌘R`) — the **📅 Important Dates Sync** menu appears in the toolbar. If it doesn't, refresh again.
8. Run **⚙ Setup Contacts Sheet** from the menu
9. **Authorize when prompted:**
   "Review permissions" → choose your Google account → "Allow"
   If you see "Google hasn't verified this app" → click "Advanced" → "Go to Important Dates Sync (unsafe)". This is normal for personal scripts that haven't been submitted to Google for review. Authorization is one-time only.
10. Fill in your data starting at row 2 — see column guide below

---

## Sheet columns

| Col | Field | Notes |
|-----|-------|-------|
| A | First Name | Required |
| B | Last Name | Optional — improves match accuracy significantly |
| C | Email | Optional — most precise match method; also pulled back from Google Contacts when blank |
| D | Birthday | Use the Sheets date picker (preferred). Or type: `YYYY-MM-DD` / `M/D/YYYY` / `MM-DD` / `M/D`. No-year dates (`MM-DD`) are stored without a year in Google Contacts |
| E | Date | Additional event date (anniversary, custom, etc.) |
| F | Label | Label for col E, e.g. `Work Anniversary`. Leave blank for anniversary |
| G+ | More pairs | Add more Date/Label pairs as needed (G+H, I+J, …) |

---

## Workflow

1. Fill in your Contacts sheet (or leave it empty to discover from Google Contacts)
2. Click **🔍 Discover** from the menu — fetches all your Google Contacts in one API call, matches against your sheet in-memory, and opens the sidebar
3. Work through the sidebar cards — each button executes immediately and the card updates in place
4. Use **↻ Re-run** in the sidebar header to refresh without reopening the menu
5. If something went wrong, use **↩ Rollback Last Created** to delete any contacts this script created this session

---

## Sidebar sections

| Section | Means |
|---------|-------|
| ⚠️ Needs Review | Nickname/partial match, or data conflicts (name, birthday, email differ) |
| ➕ New to Contacts | In sheet but no Google Contact found |
| 📥 New to Sheet | In Google Contacts with dates, not in your sheet |
| ⚠️ Possible Duplicate | Similar name already in sheet — consider merging in Google Contacts first |
| ✅ Ready to Sync | High-confidence match, dates need updating |
| ✓ Already in Sync | Everything matches — nothing to do |
| 🚫 Ignored | Contacts you've chosen not to track. Collapsed by default. |

---

## Actions

| Button | What it does |
|--------|-------------|
| **Push to Contact** | Pushes dates from sheet to Google Contact. Never changes the contact's name. |
| **Pull from Contact** | Pulls contact name + email → sheet cols A/B/C, then pushes dates to contact. Use when the contact name is more accurate than the sheet. |
| **Create Contact** | Creates a new Google Contact from the sheet row |
| **Import to Sheet** | Appends the Google Contact's dates as a new row in the sheet |
| **Import All** | Batch-imports all "New to Sheet" contacts at once |
| **Push All** | Batch-pushes all "Ready to Sync" contacts at once |
| **Untrack ▾** | Expands inline: choose Birthday, a specific event label, or All dates. Partial untracks keep the row; "All dates" deletes the row and adds to Ignored |
| **Ignore** | Hides from sidebar without touching any data. Appears in 🚫 Ignored at the bottom |
| **Wrong Match** | Flags this as a bad match. Re-run Discover to try again |
| **Skip** | Dismisses the card for this session only |
| **Track Again** | (In Ignored section) Restores dates to contact, restores sheet row, resurfaces the card |

---

## Notes

**Profile birthdays** — some contacts share their birthday via their Google account (shown as 🔒 in the sidebar). These are read-only and can't be modified or cleared here.

**Ignored contacts** — stored in Script Properties, not in the sheet. Visible and manageable in the 🚫 Ignored section of the sidebar. "Track Again" fully restores all data.

**Matching logic** — uses one bulk `connections.list` API call to fetch all your contacts, then matches in-memory in this order:
1. Email (most precise)
2. Exact full name
3. Nickname variants (60+ groups: Jen ↔ Jennifer, Joe ↔ Joseph, Bob ↔ Robert, etc.)
4. Partial name
5. First name only (fallback when no last name is given)

**Conflicts** — if a matched contact already has a different birthday or email, the card goes to ⚠️ Needs Review so you can decide which side is correct.

**Idempotent** — safe to run multiple times. Already-synced contacts show as ✓ Already in Sync and are skipped unless something has changed.

---

## Requirements

- A Google account
- Google Sheets
- Google Contacts (People API — enabled during setup, free)

No paid services, no third-party integrations, no local install.

---

## License

MIT — use it, fork it, share it.
