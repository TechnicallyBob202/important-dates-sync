/**
 * Important Dates Sync
 * ============================================================
 * Syncs birthdays and important dates between a Google Sheet
 * and Google Contacts. Bidirectional — pushes from sheet to
 * contacts, pulls from contacts to sheet, and imports contacts
 * that have dates you haven't tracked yet. Everything runs
 * through a sidebar panel — no extra sheets needed.
 *
 * ─── WHAT THIS SCRIPT WILL AND WON'T DO ───────────────────────────────────
 *   WILL:
 *   - Add or update dates on existing Google Contacts
 *   - Add email to a contact that doesn't have one
 *   - Create new contacts (only when you click "Create Contact")
 *   - Pull name/email from contact to sheet (only on "Pull from Contact")
 *   - Import contacts with dates into the sheet (only on "Import to Sheet")
 *   - Clear dates from contacts (only when you click "Untrack" or "Clear")
 *   - Delete sheet rows (only on "Untrack → All dates")
 *   WON'T:
 *   - Delete any Google Contact (Rollback only removes contacts
 *     THIS SCRIPT created in the current session)
 *   - Modify birthdays sourced from a person's Google profile (read-only)
 *   - Touch anything you haven't explicitly clicked a button for
 *
 * ─── SETUP (one-time) ──────────────────────────────────────────────────────
 *   1. Open the Google Sheet with your contacts data
 *   2. Extensions > Apps Script
 *   3. Name the project — click "Untitled project" top-left and rename to
 *      "Important Dates Sync". This name appears in the Google OAuth prompt;
 *      without it you'll see "Untitled project" which looks sketchy.
 *   4. Paste this script, replacing all default content
 *   5. Enable the People API:
 *      Left sidebar → Services (+) → find "People API" → Add
 *      (shows up as "Peopleapi" in the list — that's the one)
 *   6. Save — Ctrl+S or "Save to Drive"
 *   7. Refresh your Sheet — the "📅 Important Dates Sync" menu appears
 *      If the menu doesn't appear, refresh the page (F5 / ⌘R)
 *   8. Run ⚙ Setup Contacts Sheet from the menu
 *   9. Authorize when prompted:
 *      "Review permissions" → choose your account → "Allow"
 *      If you see "Google hasn't verified this app" → Advanced →
 *      "Go to Important Dates Sync (unsafe)". Normal for personal scripts.
 *      Authorization is one-time only.
 *  10. Fill in your data starting at row 2. Cols A-D are yours (First, Last,
 *      Email, Birthday). Cols E-F are an additional date/label pair.
 *      Add more pairs in G-H, I-J, etc. as needed.
 *
 * ─── CONTACTS SHEET COLUMNS ────────────────────────────────────────────────
 *   A  First Name    Required
 *   B  Last Name     Optional — improves match accuracy significantly
 *   C  Email         Optional — most precise match method; also pulled back
 *                    into this column from Google Contacts when blank
 *   D  Birthday      Use the Sheets date picker (preferred — format doesn't
 *                    matter). Or type: YYYY-MM-DD / M/D/YYYY / MM-DD / M/D
 *                    No-year dates (MM-DD or M/D) are stored without a year
 *                    in Google Contacts (shows as "---- MM DD")
 *   E  Date          Additional event date (anniversary, custom, etc.)
 *   F  Label         Label for col E (e.g. "Work Anniversary"). Blank = anniversary
 *   G+ More pairs    Additional Date/Label pairs as needed (G+H, I+J, ...)
 *
 * ─── WORKFLOW ──────────────────────────────────────────────────────────────
 *   1. Fill in your Contacts sheet (or leave it empty to import from contacts)
 *   2. 🔍 Discover from the menu — fetches ALL your Google Contacts in one
 *      call, matches against your sheet in-memory, and opens the sidebar
 *   3. Work through the sidebar cards — each button action runs immediately
 *      and the card updates in place. Use ↻ Re-run to refresh.
 *   4. ↩ Rollback — deletes any contacts this script created this session
 *
 * ─── SIDEBAR SECTIONS ──────────────────────────────────────────────────────
 *   ⚠️ Needs Review      Nickname/partial match, or data conflicts between
 *                        sheet and contact (name, birthday, email differ)
 *   ➕ New to Contacts   In sheet but no Google Contact found → Create
 *   📥 New to Sheet      In Google Contacts with dates, not in sheet → Import
 *   ⚠️ Possible Dup     Similar name already in sheet — suggests merging
 *                        in Google Contacts before importing
 *   ✅ Ready to Sync     High-confidence match, dates need updating → Sync
 *   ✓  Already in Sync   Everything matches — nothing to do
 *   🚫 Ignored           Contacts you've chosen not to track. Collapsed by
 *                        default. Use "Track Again" to restore.
 *
 * ─── ACTIONS ───────────────────────────────────────────────────────────────
 *   Push to Contact      Push dates from sheet to Google Contact.
 *                        This script is a DATE TRACKER, not a contact manager
 *                        — it never changes a contact's name. To fix a name,
 *                        edit it directly in Google Contacts.
 *   Pull from Contact    Pull contact name + email → sheet cols A/B/C, then
 *                        push dates to contact. Use when the contact name is
 *                        "more right" than what's in the sheet (helps future
 *                        matching accuracy).
 *   Create Contact       Create a new Google Contact from this sheet row.
 *   Import to Sheet      Append this Google Contact's dates to the sheet.
 *   Import All           Batch-import all "New to Sheet" contacts at once.
 *   Push All             Batch-push all "Ready to Sync" contacts at once.
 *   Untrack ▾            Expands inline — choose which dates to remove:
 *                          [Birthday]  — clears birthday from contact + col D
 *                          [Label]     — clears that specific event from
 *                                        contact + its sheet columns
 *                          [All dates] — clears all dates, deletes sheet row,
 *                                        adds to Ignored (restorable)
 *   Ignore               Hides from sidebar without touching any data.
 *                        Contact appears in 🚫 Ignored section at the bottom.
 *   Wrong Match          Flags this as a bad match. Re-run Discover to retry.
 *   Skip                 Dismisses the card for this session only.
 *
 * ─── NOTES ─────────────────────────────────────────────────────────────────
 *   - Profile birthdays: some contacts share their birthday via their Google
 *     account (shown as 🔒). These are read-only and can't be cleared here.
 *   - Ignored contacts: stored in Script Properties. Visible and manageable
 *     in the 🚫 Ignored section of the sidebar. "Track Again" restores all
 *     data (dates back to contact, row back to sheet) and resurfaces the card.
 *   - Matching: uses one bulk API call to fetch all contacts, then matches
 *     in-memory by email (most precise), exact name, nickname variants
 *     (Jen → Jennifer, Joe → Joseph, etc.), partial name, or first name only.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const CONTACTS_SHEET = 'Contacts';
const CCOL = { FIRST: 1, LAST: 2, EMAIL: 3, BIRTHDAY: 4 };
// Cols 5+ are additional Date/Label pairs: (5,6), (7,8), (9,10)...

const API_DELAY_MS  = 150;
const SEARCH_MASK   = 'names,emailAddresses,birthdays,events';
const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,birthdays,events,metadata';


// ─── Nickname Lookup ──────────────────────────────────────────────────────────

const NICKNAME_GROUPS = [
  ['alexander','alex','al','lex'],['alexandra','alex','allie','lexi','sandy'],
  ['andrew','andy','drew'],['ann','anne','annie','anna'],['anthony','tony'],
  ['barbara','barb','barbie','babs'],['benjamin','ben','benny','benji'],
  ['bill','billy','will','willie','william'],['bob','bobby','rob','robby','robert'],
  ['catherine','cathy','kathy','kate','katie','kat','katherine','kathryn'],
  ['charles','charlie','chuck','chaz'],['christopher','chris'],['cindy','cynthia'],
  ['dan','danny','daniel'],['dave','david','davy'],['deborah','debbie','deb'],
  ['diana','di','diane'],['dorothy','dot','dottie'],
  ['ed','eddie','edward','ted','teddy'],
  ['elizabeth','liz','lizzie','beth','betty','eliza','libby','ellie','bette'],
  ['frank','frankie','francis'],['fred','freddy','frederick'],['george','georgie'],
  ['gregory','greg'],['harold','hal','harry'],['jack','john','johnny'],
  ['james','jim','jimmy','jamie'],['jason','jay'],['jeff','jeffrey'],
  ['jen','jenny','jennifer'],['jessica','jess','jessie'],['joe','joey','joseph'],
  ['jonathan','jon','johnny'],['joshua','josh'],['judith','judy'],
  ['julie','julia','jules'],['karen','kari'],['kenneth','ken','kenny'],
  ['kristine','kristina','kris','kristen','kristin'],['larry','lawrence'],
  ['linda','lindy'],['margaret','maggie','meg','peggy','peg','marge','margie'],
  ['matt','matthew','matty'],['michael','mike','mikey','micky','mick'],
  ['michelle','shelley'],['nathaniel','nate','nat','nathan'],
  ['nicholas','nick','nicky','nico'],['pamela','pam'],
  ['patricia','pat','patty','tricia'],['patrick','pat','paddy'],
  ['peter','pete'],['philip','phil'],['ray','raymond'],
  ['richard','rick','ricky','rich','dick'],['robert','rob','bob','bobby','robby'],
  ['ronald','ron','ronnie'],['samuel','sam','sammy'],['samantha','sam','sammie'],
  ['sandra','sandy','sandi'],['sarah','sara','sally'],
  ['stephen','steve','stevie','steven'],['susan','sue','suzy','susie','suzanne'],
  ['teresa','theresa','terri','terry','tess'],['thomas','tom','tommy'],
  ['timothy','tim','timmy'],['victoria','vicky','vic'],['vincent','vince','vinnie'],
  ['walter','walt','wally'],['william','bill','billy','will','willie'],
  ['zachary','zach','zack','zak'],
];

const NICKNAME_LOOKUP = (() => {
  const map = {};
  for (const group of NICKNAME_GROUPS) {
    for (const name of group) {
      const key = name.toLowerCase();
      if (!map[key]) map[key] = [];
      for (const v of group) if (!map[key].includes(v)) map[key].push(v.toLowerCase());
    }
  }
  return map;
})();

function getNameVariants(name) {
  return NICKNAME_LOOKUP[name.toLowerCase()] || [name.toLowerCase()];
}


// ─── Date Helpers ─────────────────────────────────────────────────────────────

function parseDate(raw) {
  if (raw instanceof Date && !isNaN(raw)) {
    return { year: raw.getFullYear(), month: raw.getMonth()+1, day: raw.getDate() };
  }
  const s = String(raw).trim();
  let m;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);       if(m) return {year:+m[1],month:+m[2],day:+m[3]};
  m = s.match(/^(\d{1,2})-(\d{1,2})$/);            if(m) return {month:+m[1],day:+m[2]};
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);  if(m) return {month:+m[1],day:+m[2],year:+m[3]};
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);           if(m) return {month:+m[1],day:+m[2]};
  if (/^\d{5}$/.test(s)) {
    const d = new Date(1899,11,30+parseInt(s,10));
    return {year:d.getFullYear(),month:d.getMonth()+1,day:d.getDate()};
  }
  throw new Error(`Cannot parse date: "${s}"`);
}

function formatDateObj(d) {
  if (!d) return '';
  return d.year ? `${d.month}/${d.day}/${d.year}` : `${d.month}/${d.day}`;
}

function datesMatch(a, b) {
  if (!a || !b) return false;
  if (a.month!==b.month || a.day!==b.day) return false;
  if (a.year && b.year && a.year!==b.year) return false;
  return true;
}

function getSheetEvents(row) {
  const events = [];
  const bRaw = row[CCOL.BIRTHDAY-1];
  if (bRaw!==''&&bRaw!=null) {
    try { events.push({dateType:'birthday',dateObj:parseDate(bRaw),label:''}); } catch(e){}
  }
  for (let c=5;c<=row.length;c+=2) {
    const dRaw = row[c-1];
    const lbl  = String(row[c]||'').trim();
    if (dRaw!==''&&dRaw!=null) {
      try { events.push({dateType:lbl?'other':'anniversary',dateObj:parseDate(dRaw),label:lbl}); } catch(e){}
    }
  }
  return events;
}

// Returns true if the contact's birthdays are ALL from Google profile (read-only)
// and none are from the contact record itself (writable)
function hasProfileOnlyBirthday(person) {
  const bdays = person.birthdays || [];
  if (!bdays.length) return false;
  const hasContact = bdays.some(b => (b.metadata?.source?.type || '').toUpperCase() === 'CONTACT');
  const hasProfile = bdays.some(b => (b.metadata?.source?.type || '').toUpperCase() === 'PROFILE');
  return hasProfile && !hasContact;
}

function birthdayMonthDayMatch(a, b) {
  // Birthdays: compare month+day only. Sheet cells often get auto-assigned the
  // current year by Sheets when the user types "2/10" without a year — so year
  // comparison would produce false mismatches against the real birth year.
  if (!a || !b) return false;
  return a.month === b.month && a.day === b.day;
}

function isAlreadySynced(person, events) {
  if (!events.length) return true;
  return events.every(event => {
    if (event.dateType==='birthday') {
      const cBday = (person.birthdays||[])[0]?.date||null;
      return cBday && birthdayMonthDayMatch(event.dateObj, cBday);
    }
    const et = event.dateType==='anniversary'?'anniversary':'custom';
    return (person.events||[]).some(e=>e.type===et && datesMatch(e.date,event.dateObj));
  });
}


// ─── Contact Search ───────────────────────────────────────────────────────────

function searchContact(firstName, lastName, email) {
  const fullName = [firstName,lastName].filter(Boolean).join(' ');
  const found=[], seen=new Set();
  const addIfNew = p => { if(p.resourceName&&!seen.has(p.resourceName)){seen.add(p.resourceName);found.push(p);} };
  const query = q => {
    try { return People.People.searchContacts({query:q,readMask:SEARCH_MASK}).results||[]; }
    catch(e){ Logger.log(`Search error (${q}): ${e.message}`); return []; }
  };

  if (email) {
    for (const r of query(email)) {
      const p=r.person;
      if((p.emailAddresses||[]).map(e=>e.value.toLowerCase()).includes(email.toLowerCase())) addIfNew(p);
    }
    if(found.length) return {people:found,confidence:'high',how:'email match'};
  }
  if (fullName) {
    const fl=fullName.toLowerCase();
    for (const r of query(fullName)) {
      const p=r.person;
      if((p.names||[]).map(n=>(n.displayName||'').toLowerCase()).some(n=>n===fl)) addIfNew(p);
    }
    if(found.length) return {people:found,confidence:'high',how:'exact name match'};
  }
  for (const v of getNameVariants(firstName).filter(v=>v!==firstName.toLowerCase())) {
    const vf=[v,lastName].filter(Boolean).join(' '), vl=vf.toLowerCase();
    for (const r of query(vf)) {
      const p=r.person;
      if((p.names||[]).map(n=>(n.displayName||'').toLowerCase()).some(n=>n===vl||n.includes(vl)||vl.includes(n))) addIfNew(p);
    }
    if(found.length) {
      const cv=v.charAt(0).toUpperCase()+v.slice(1);
      return {people:found,confidence:'low',how:`nickname: ${firstName} → ${cv}`};
    }
  }
  if (fullName) {
    const fl=fullName.toLowerCase();
    for (const r of query(fullName)) {
      const p=r.person;
      if((p.names||[]).map(n=>(n.displayName||'').toLowerCase()).some(n=>n.includes(fl)||fl.includes(n))) addIfNew(p);
    }
    if(found.length) {
      const matched=(found[0].names||[{}])[0].displayName||fullName;
      return {people:found,confidence:'low',how:`partial: "${fullName}" ~ "${matched}"`};
    }
  }
  if (firstName&&!lastName) {
    const fl=firstName.toLowerCase();
    for (const r of query(firstName)) {
      const p=r.person;
      if((p.names||[]).map(n=>(n.givenName||'').toLowerCase()).some(n=>n===fl)) addIfNew(p);
    }
    if(found.length) return {people:found,confidence:'low',how:'first name only'};
  }
  return {people:[],confidence:'none',how:'no match'};
}


// ─── Conflict Detection ───────────────────────────────────────────────────────

function detectConflicts(person, sheetData) {
  const conflicts = [];

  // Compare givenName + familyName (not displayName — which Google sometimes stores
  // as "Last,First" or includes middle names that throw off a simple string compare)
  const cFirst = (person.names||[{}])[0].givenName  || '';
  const cLast  = (person.names||[{}])[0].familyName || '';
  const sFirst = sheetData.firstName || '';
  const sLast  = sheetData.lastName  || '';

  // Allow middle names: "Juan Pablo" matches sheet "Juan" if it starts with "Juan "
  const firstMatch = cFirst.toLowerCase() === sFirst.toLowerCase()
    || cFirst.toLowerCase().startsWith(sFirst.toLowerCase() + ' ')
    || sFirst.toLowerCase().startsWith(cFirst.toLowerCase() + ' ');
  const lastMatch  = cLast.toLowerCase() === sLast.toLowerCase();

  if (!firstMatch || !lastMatch) {
    const displayName = (person.names||[{}])[0].displayName || `${cFirst} ${cLast}`.trim();
    conflicts.push(`Name: sheet "${[sFirst,sLast].filter(Boolean).join(' ')}" ≠ contact "${displayName}"`);
  }
  if (sheetData.birthday&&(person.birthdays||[]).length>0) {
    const cBday = person.birthdays[0].date;
    if (!datesMatch(sheetData.birthday,cBday))
      conflicts.push(`Birthday: sheet ${formatDateObj(sheetData.birthday)} ≠ contact ${formatDateObj(cBday)}`);
  }
  const cEmails = (person.emailAddresses||[]).map(e=>e.value);
  if (sheetData.email&&cEmails.length>0) {
    if (!cEmails.map(e=>e.toLowerCase()).includes(sheetData.email.toLowerCase()))
      conflicts.push(`Email: sheet "${sheetData.email}" ≠ contact "${cEmails[0]}"`);
  }
  return conflicts;
}


// ─── Fetch All Google Contacts (one bulk call) ───────────────────────────────
// Load everything once, match in-memory — avoids per-row API quota hits.

function getAllContacts() {
  const results = [];
  let pageToken  = null;
  do {
    const params = { pageSize: 200, personFields: PERSON_FIELDS };
    if (pageToken) params.pageToken = pageToken;
    const resp = People.People.Connections.list('people/me', params);
    for (const p of resp.connections||[]) results.push(p);
    pageToken = resp.nextPageToken||null;
  } while (pageToken);
  return results;
}

function hasDateData(person) {
  return (person.birthdays||[]).length > 0 || (person.events||[]).length > 0;
}

/** Build in-memory lookup indexes from the full contact list. */
function buildIndexes(allContacts) {
  const byEmail   = {};  // email (lower) → person
  const byName    = {};  // full name (lower) → person  (exact)
  const byVariant = {};  // nickname/variant full name (lower) → person (fuzzy)

  for (const person of allContacts) {
    const givenName  = (person.names||[{}])[0].givenName  || '';
    const familyName = (person.names||[{}])[0].familyName || '';
    const fullName   = [givenName, familyName].filter(Boolean).join(' ').toLowerCase();

    // Email index
    for (const e of person.emailAddresses||[]) {
      byEmail[e.value.toLowerCase()] = person;
    }

    // Exact name index (prefer givenName+familyName over displayName)
    if (fullName) byName[fullName] = person;
    const displayName = ((person.names||[{}])[0].displayName||'').toLowerCase();
    if (displayName && !byName[displayName]) byName[displayName] = person;

    // Nickname/variant index
    if (givenName) {
      for (const v of getNameVariants(givenName)) {
        const vf = [v, familyName].filter(Boolean).join(' ').toLowerCase();
        if (!byName[vf] && !byVariant[vf]) byVariant[vf] = person;
      }
    }
  }
  return { byEmail, byName, byVariant };
}

/** Match a sheet row to a contact using in-memory indexes. */
function matchInMemory(firstName, lastName, email, indexes) {
  const { byEmail, byName, byVariant } = indexes;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').toLowerCase();

  // 1. Email — high confidence
  if (email && byEmail[email.toLowerCase()]) {
    return { person: byEmail[email.toLowerCase()], confidence: 'high', how: 'email match' };
  }

  // 2. Exact name — high confidence
  if (byName[fullName]) {
    return { person: byName[fullName], confidence: 'high', how: 'exact name match' };
  }

  // 3. Nickname/variant — low confidence
  if (byVariant[fullName]) {
    const matched = (byVariant[fullName].names||[{}])[0].displayName || '';
    return { person: byVariant[fullName], confidence: 'low', how: `nickname: ${firstName} → ${matched.split(' ')[0]}` };
  }

  // 4. Partial name — low confidence
  for (const [key, person] of Object.entries(byName)) {
    if (key !== fullName && (key.includes(fullName) || fullName.includes(key))) {
      const matched = (person.names||[{}])[0].displayName || key;
      return { person, confidence: 'low', how: `partial: "${[firstName,lastName].filter(Boolean).join(' ')}" ~ "${matched}"` };
    }
  }

  // 5. First-name-only fallback (no last name given)
  if (firstName && !lastName) {
    const fl = firstName.toLowerCase();
    const hit = Object.values(byName).find(p =>
      ((p.names||[{}])[0].givenName||'').toLowerCase() === fl
    );
    if (hit) return { person: hit, confidence: 'low', how: 'first name only' };
  }

  return { person: null, confidence: 'none', how: 'no match' };
}

function nameIsSimilar(person, sheetFirst, sheetLast) {
  // Use givenName/familyName directly — displayName can be "Last, First" which breaks parsing
  const cFirst   = ((person.names||[{}])[0].givenName  ||'').toLowerCase();
  const cLast    = ((person.names||[{}])[0].familyName ||'').toLowerCase();
  const sf       = (sheetFirst||'').toLowerCase();
  const sl       = (sheetLast ||'').toLowerCase();
  if (cLast !== sl) return false;
  const variants = [...getNameVariants(sf), ...getNameVariants(cFirst)];
  return variants.includes(cFirst) || variants.includes(sf);
}


// ─── Contact Write Operations ─────────────────────────────────────────────────

function getFullContact(resourceName) {
  return People.People.get(resourceName, {personFields:PERSON_FIELDS});
}

function pushToContact(resourceName, events, opts) {  // opts: { pushEmail, email }
  const current = getFullContact(resourceName);
  const body={etag:current.etag}, changed=[];

  const birthdays   = events.filter(e=>e.dateType==='birthday');
  const otherEvents = events.filter(e=>e.dateType!=='birthday');

  if (birthdays.length) {
    const cBday = (current.birthdays||[])[0]?.date||null;
    if (cBday && hasProfileOnlyBirthday(current) && birthdayMonthDayMatch(cBday, birthdays[0].dateObj)) {
      // Birthday exists as profile (read-only) and matches — skip writing, count as synced
      changed.push('birthday (profile — read-only, matches)');
    } else if (!birthdayMonthDayMatch(cBday, birthdays[0].dateObj)) {
      body.birthdays=[{date:birthdays[0].dateObj}]; changed.push('birthday');
    }
  }
  if (otherEvents.length) {
    const kept=(current.events||[]).filter(e=>{
      return !otherEvents.some(ne=>{
        const et=ne.dateType==='anniversary'?'anniversary':'custom';
        return e.type===et&&(!ne.label||e.formattedType===ne.label);
      });
    });
    const newEvts=otherEvents.map(e=>({
      date:e.dateObj,
      type:e.dateType==='anniversary'?'anniversary':'custom',
      formattedType:e.label||e.dateType
    }));
    if (newEvts.some(ne=>!kept.find(ke=>datesMatch(ke.date,ne.date)&&ke.type===ne.type))) {
      body.events=[...kept,...newEvts]; changed.push('events');
    }
  }
  if (opts.pushEmail&&opts.email) {
    const existing=(current.emailAddresses||[]).map(e=>e.value.toLowerCase());
    if (!existing.includes(opts.email.toLowerCase())) {
      body.emailAddresses=[...(current.emailAddresses||[]),{value:opts.email}];
      changed.push('email → contact');
    }
  }
  if (changed.length) {
    const fields=[];
    if(changed.includes('birthday'))        fields.push('birthdays');
    if(changed.includes('events'))          fields.push('events');
    if(changed.includes('email → contact')) fields.push('emailAddresses');
    People.People.updateContact(body, resourceName, {updatePersonFields:fields.join(',')});
  }
  return changed;
}

function createNewContact(firstName, lastName, email, events) {
  const body={names:[{givenName:firstName,familyName:lastName||''}]};
  if(email) body.emailAddresses=[{value:email}];
  const bdays=events.filter(e=>e.dateType==='birthday');
  const other=events.filter(e=>e.dateType!=='birthday');
  if(bdays.length)  body.birthdays=[{date:bdays[0].dateObj}];
  if(other.length)  body.events=other.map(e=>({
    date:e.dateObj,
    type:e.dateType==='anniversary'?'anniversary':'custom',
    formattedType:e.label||e.dateType
  }));
  return People.People.createContact(body);
}


// ─── Main Discover (server-side, returns cards for sidebar) ──────────────────
// Uses ONE bulk connections.list call, then matches in-memory.
// Avoids per-row searchContacts calls that blow the API quota.

function getDiscoverData() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTACTS_SHEET);
  if (!sheet) return { error: `Sheet "${CONTACTS_SHEET}" not found.` };

  const data = sheet.getDataRange().getValues();
  const cards = [];
  const matchedResourceNames = new Set();

  // Single bulk fetch — one API call for everything
  const allContacts = getAllContacts();
  const indexes     = buildIndexes(allContacts);

  const sheetNames = data.slice(1).map(r => ({
    firstName: String(r[CCOL.FIRST-1]||'').trim(),
    lastName:  String(r[CCOL.LAST -1]||'').trim(),
  })).filter(r => r.firstName);

  // ── Phase 1: Match sheet rows against in-memory index ─────────────────────
  for (let i = 1; i < data.length; i++) {
    const row       = data[i];
    const firstName = String(row[CCOL.FIRST-1]||'').trim();
    const lastName  = String(row[CCOL.LAST -1]||'').trim();
    const email     = String(row[CCOL.EMAIL-1]||'').trim();
    if (!firstName) continue;

    const events   = getSheetEvents(row);
    const birthday = events.find(e=>e.dateType==='birthday')?.dateObj||null;

    const { person, confidence, how } = matchInMemory(firstName, lastName, email, indexes);
    if (person) matchedResourceNames.add(person.resourceName);

    const profileBday = person ? hasProfileOnlyBirthday(person) : false;
    const conflicts   = person ? detectConflicts(person, { firstName, lastName, email, birthday }) : [];
    const inSync      = person && events.length && isAlreadySynced(person, events);
    const matchName   = person ? (person.names||[{}])[0].displayName||'' : '';
    const cEmails     = person ? (person.emailAddresses||[]).map(e=>e.value) : [];

    let type;
    if      (!person)                                type = 'new-to-contacts';
    else if (confidence==='low')                     type = 'needs-review';
    else if (confidence==='high' && conflicts.length) type = 'needs-review';
    else if (inSync)                                 type = 'in-sync';
    else                                             type = 'ready';

    cards.push({
      id:           `sheet-${i+1}`,
      profileBday, type,
      contactsRow:  i+1,
      firstName, lastName, email,
      events:       events.map(e=>({...e, dateObj:{...e.dateObj}})),
      resourceName: person?.resourceName||'',
      matchName, confidence, how, conflicts,
      contactEmail: cEmails[0]||'',
    });
  }

  // ── Phase 2: Contacts with dates not matched to any sheet row ─────────────
  // Build an exact-name set from sheet for hard-blocking re-imports
  const sheetNameSet = new Set(
    data.slice(1)
      .map(r => [String(r[CCOL.FIRST-1]||'').trim(), String(r[CCOL.LAST-1]||'').trim()]
        .filter(Boolean).join(' ').toLowerCase())
      .filter(Boolean)
  );

  for (const person of allContacts) {
    if (!hasDateData(person))                          continue;
    if (matchedResourceNames.has(person.resourceName)) continue;
    if (isIgnored(person.resourceName))                continue;

    const cFirst = (person.names||[{}])[0].givenName  ||'';
    const cLast  = (person.names||[{}])[0].familyName ||'';
    const cName  = (person.names||[{}])[0].displayName||[cFirst,cLast].filter(Boolean).join(' ');
    const cEmail = (person.emailAddresses||[])[0]?.value||'';

    // Hard-block: if givenName+familyName exactly matches any sheet row, skip —
    // they were already matched (or the match failed silently). Don't re-import.
    const cFullLower = [cFirst, cLast].filter(Boolean).join(' ').toLowerCase();
    if (cFullLower && sheetNameSet.has(cFullLower)) continue;

    // Extract dates — deduplicate events whose date matches the birthday
    const bdayDate = (person.birthdays||[])[0]?.date || null;
    const contactDates = [];
    for (const b of person.birthdays||[]) {
      contactDates.push({ type:'birthday', dateStr:formatDateObj(b.date), label:'' });
    }
    for (const e of person.events||[]) {
      // Skip events that are the same month/day as the birthday — likely a sync artifact
      if (bdayDate && birthdayMonthDayMatch(e.date, bdayDate)) continue;
      contactDates.push({ type:e.type||'other', dateStr:formatDateObj(e.date), label:e.formattedType||e.type||'' });
    }

    const profileBday = hasProfileOnlyBirthday(person);
    const simMatch    = sheetNames.find(r => nameIsSimilar(person, r.firstName, r.lastName));
    const type        = simMatch ? 'possible-duplicate' : 'new-to-sheet';

    cards.push({
      id:           `contact-${person.resourceName}`,
      type, profileBday,
      contactsRow:  null,
      resourceName: person.resourceName,
      matchName:    cName,
      firstName:    cFirst,
      lastName:     cLast,
      email:        cEmail,
      contactDates,
      similarTo:    simMatch ? `${simMatch.firstName} ${simMatch.lastName}`.trim() : '',
    });
  }

  return { cards };
}


// ─── Execute Card Action (called by sidebar) ──────────────────────────────────

function executeCardAction(card, action, actionData) {
  card.actionData = actionData || {};
  try {
    const ss            = SpreadsheetApp.getActiveSpreadsheet();
    const contactsSheet = ss.getSheetByName(CONTACTS_SHEET);
    if (!contactsSheet) throw new Error('Contacts sheet not found');

    let result = '';

    switch(action) {

      case 'skip':
        result = '⏭ Skipped';
        break;

      case 'push to contact': {
        const cData  = contactsSheet.getDataRange().getValues();
        const cRow   = cData[card.contactsRow-1];
        const events = getSheetEvents(cRow);
        const email  = String(cRow[CCOL.EMAIL-1]||'').trim();
        const changed = pushToContact(card.resourceName, events, {pushEmail:true,email});
        const current = getFullContact(card.resourceName);
        const cEmail  = (current.emailAddresses||[])[0]?.value||null;
        if (!email&&cEmail) {
          contactsSheet.getRange(card.contactsRow,CCOL.EMAIL).setValue(cEmail);
          changed.push('email → sheet');
        }
        result = changed.length ? `✅ ${changed.join(' | ')}` : '✅ no change required';
        break;
      }

      case 'pull from contact': {
        const cData   = contactsSheet.getDataRange().getValues();
        const cRow    = cData[card.contactsRow-1];
        const events  = getSheetEvents(cRow);
        const current = getFullContact(card.resourceName);
        const cFirst  = (current.names||[{}])[0].givenName||'';
        const cLast   = (current.names||[{}])[0].familyName||'';
        const cEmail  = (current.emailAddresses||[])[0]?.value||null;
        const pulled  = [];
        const shFirst = String(cRow[CCOL.FIRST-1]||'');
        const shLast  = String(cRow[CCOL.LAST -1]||'');
        const shEmail = String(cRow[CCOL.EMAIL-1]||'');
        if (cFirst!==shFirst||cLast!==shLast) {
          contactsSheet.getRange(card.contactsRow,CCOL.FIRST).setValue(cFirst);
          contactsSheet.getRange(card.contactsRow,CCOL.LAST).setValue(cLast);
          pulled.push('name → sheet');
        }
        if (cEmail&&cEmail!==shEmail) {
          contactsSheet.getRange(card.contactsRow,CCOL.EMAIL).setValue(cEmail);
          pulled.push('email → sheet');
        }
        const dateChanged = pushToContact(card.resourceName, events, {pushEmail:false});
        if (dateChanged.length) pulled.push(...dateChanged.map(f=>`${f} → contact`));
        result = pulled.length ? `✅ ${pulled.join(' | ')}` : '✅ no change required';
        break;
      }

      case 'create contact': {
        const cData  = contactsSheet.getDataRange().getValues();
        const cRow   = cData[card.contactsRow-1];
        const events = getSheetEvents(cRow);
        const first  = String(cRow[CCOL.FIRST-1]||'').trim();
        const last   = String(cRow[CCOL.LAST -1]||'').trim();
        const email  = String(cRow[CCOL.EMAIL-1]||'').trim();
        const created = createNewContact(first,last,email,events);
        result = `✅ created [${created.resourceName}]`;
        break;
      }

      case 'import to sheet': {
        // Build row: First, Last, Email, Birthday, [Date, Label pairs...]
        const row = [card.firstName||'', card.lastName||'', card.email||'', ''];
        let bdayDateStr = '';
        for (const d of card.contactDates||[]) {
          if (d.type==='birthday') { row[3] = d.dateStr; bdayDateStr = d.dateStr; }
        }
        for (const d of card.contactDates||[]) {
          if (d.type==='birthday') continue;
          // Skip events that share the same date as the birthday — sync artifact
          if (bdayDateStr && d.dateStr === bdayDateStr) continue;
          row.push(d.dateStr||''); row.push(d.label||d.type||'');
        }
        contactsSheet.appendRow(row);
        result = `✅ imported to sheet (row ${contactsSheet.getLastRow()})`;
        break;
      }

      case 'ignore': {
        // Add to ignore list without touching contact or sheet data
        addToIgnoreList({
          resourceName: card.resourceName,
          firstName:    card.firstName,
          lastName:     card.lastName,
          email:        card.email,
          displayName:  card.matchName || [card.firstName,card.lastName].filter(Boolean).join(' '),
          reason:       'ignored',
          dates:        (card.contactDates||card.events||[]).map(d=>({
            dateType: d.dateType||d.type||'other',
            dateStr:  d.dateStr || formatDateObj(d.dateObj) || '',
            label:    d.label||''
          })),
          deletedRow: null,
        });
        result = '🚫 Ignored';
        break;
      }

      case 'untrack-birthday': {
        // Clear only the birthday from the contact
        const current  = getFullContact(card.resourceName);
        const body     = { etag: current.etag };
        const profBdays = (current.birthdays||[]).filter(b =>
          (b.metadata?.source?.type||'').toUpperCase() === 'PROFILE'
        );
        body.birthdays = profBdays; // keep profile ones, drop contact ones
        People.People.updateContact(body, card.resourceName, { updatePersonFields: 'birthdays' });
        // Clear col D in sheet
        if (card.contactsRow) {
          contactsSheet.getRange(card.contactsRow, CCOL.BIRTHDAY).clearContent();
        }
        result = '✅ Birthday cleared from contact + sheet';
        break;
      }

      case 'untrack-event': {
        // Clear a specific non-birthday event (identified by index in card.events)
        const evtIndex = card.actionData?.eventIndex ?? 0;
        const current  = getFullContact(card.resourceName);
        const sheetEvents = card.events || [];
        const nonBdayEvents = sheetEvents.filter(e => e.dateType !== 'birthday');
        const target   = nonBdayEvents[evtIndex];
        if (target) {
          const eventType = target.dateType === 'anniversary' ? 'anniversary' : 'custom';
          const remaining = (current.events||[]).filter(e =>
            !(e.type === eventType && (!target.label || e.formattedType === target.label))
          );
          const body = { etag: current.etag, events: remaining };
          People.People.updateContact(body, card.resourceName, { updatePersonFields: 'events' });
          // Clear corresponding sheet cols (birthday is col 4, events start at col 5 in pairs)
          if (card.contactsRow) {
            const dateCol = 5 + (evtIndex * 2);
            contactsSheet.getRange(card.contactsRow, dateCol, 1, 2).clearContent();
          }
        }
        result = '✅ Event cleared from contact + sheet';
        break;
      }

      case 'untrack-all': {
        // Clear all dates from contact, delete sheet row, add to ignore list
        const current  = getFullContact(card.resourceName);
        const profBdays = (current.birthdays||[]).filter(b =>
          (b.metadata?.source?.type||'').toUpperCase() === 'PROFILE'
        );
        const body = { etag: current.etag, birthdays: profBdays, events: [] };
        People.People.updateContact(body, card.resourceName, { updatePersonFields: 'birthdays,events' });

        // Save row data and delete it
        let deletedRow = null;
        if (card.contactsRow) {
          const cData = contactsSheet.getDataRange().getValues();
          deletedRow  = cData[card.contactsRow-1].map(v=>String(v));
          contactsSheet.deleteRow(card.contactsRow);
        }

        addToIgnoreList({
          resourceName: card.resourceName,
          firstName:    card.firstName,
          lastName:     card.lastName,
          email:        card.email,
          displayName:  card.matchName || [card.firstName,card.lastName].filter(Boolean).join(' '),
          reason:       'all dates cleared',
          dates:        (card.events||[]).map(e=>({
            dateType: e.dateType,
            dateStr:  formatDateObj(e.dateObj)||'',
            label:    e.label||''
          })),
          deletedRow,
        });
        result = '🚫 All dates cleared + added to ignored';
        break;
      }

      case 'clear birthday': {
        const current   = getFullContact(card.resourceName);
        const body      = { etag: current.etag };
        // Remove CONTACT-sourced birthdays only; profile ones are untouched
        const remaining = (current.birthdays||[]).filter(b =>
          (b.metadata?.source?.type||'').toUpperCase() === 'PROFILE'
        );
        body.birthdays  = remaining;
        People.People.updateContact(body, card.resourceName, { updatePersonFields: 'birthdays' });

        // Build ignore entry with full data for restoration
        const ignoreEntry = {
          resourceName: card.resourceName,
          firstName:    card.firstName,
          lastName:     card.lastName,
          email:        card.email,
          displayName:  card.matchName,
          reason:       'birthday cleared',
          dates:        (card.contactDates||[]).filter(d=>d.type==='birthday'),
          deletedRow:   null,
        };

        // Remove sheet row if it exists and has no other dates
        if (card.contactsRow) {
          const cData   = contactsSheet.getDataRange().getValues();
          const cRow    = cData[card.contactsRow - 1];
          const events  = getSheetEvents(cRow);
          const nonBday = events.filter(e=>e.dateType!=='birthday');
          if (nonBday.length === 0) {
            // Save row data for restoration, then delete
            ignoreEntry.deletedRow = cRow.filter((_,i) => i < 9).map(v => String(v));
            contactsSheet.deleteRow(card.contactsRow);
          } else {
            // Just clear the birthday column
            contactsSheet.getRange(card.contactsRow, CCOL.BIRTHDAY).clearContent();
          }
        }

        addToIgnoreList(ignoreEntry);
        result = '🚫 Birthday cleared + added to ignored';
        break;
      }

      case 'wrong match':
        result = '↩ Flagged as wrong match — re-run Discover to retry';
        break;

      default:
        result = `❌ Unknown action: ${action}`;
    }

    return {success:true, result};

  } catch(e) {
    Logger.log(`executeCardAction error: ${e.message}`);
    return {success:false, result:`❌ ${e.message}`};
  }
}


// ─── Ignore List ─────────────────────────────────────────────────────────────

const IGNORE_KEY = 'ignored_contacts';

function getIgnoreList() {
  const raw = PropertiesService.getScriptProperties().getProperty(IGNORE_KEY) || '[]';
  try { return JSON.parse(raw); } catch(e) { return []; }
}

function saveIgnoreList(list) {
  PropertiesService.getScriptProperties().setProperty(IGNORE_KEY, JSON.stringify(list));
}

function addToIgnoreList(entry) {
  const list = getIgnoreList();
  if (!list.find(e => e.resourceName === entry.resourceName)) {
    list.push(entry);
    saveIgnoreList(list);
  }
}

function removeFromIgnoreList(resourceName) {
  const list = getIgnoreList().filter(e => e.resourceName !== resourceName);
  saveIgnoreList(list);
}

function isIgnored(resourceName) {
  return getIgnoreList().some(e => e.resourceName === resourceName);
}

/**
 * Restore an ignored contact:
 * 1. Remove from ignore list
 * 2. Re-add birthday to Google Contact
 * 3. Re-add sheet row if it was deleted
 * 4. Return a fresh card for the sidebar
 */
function trackAgain(resourceName) {
  try {
    const list  = getIgnoreList();
    const entry = list.find(e => e.resourceName === resourceName);
    if (!entry) return { success: false, result: '❌ Not found in ignore list' };

    const ss             = SpreadsheetApp.getActiveSpreadsheet();
    const contactsSheet  = ss.getSheetByName(CONTACTS_SHEET);
    if (!contactsSheet) throw new Error('Contacts sheet not found');

    // Restore birthday to Google Contact
    if (entry.dates && entry.dates.length) {
      const current = getFullContact(resourceName);
      const body    = { etag: current.etag };
      const fields  = [];
      const bday    = entry.dates.find(d => d.dateType === 'birthday');
      if (bday) {
        try {
          body.birthdays = [{ date: parseDate(bday.dateStr) }];
          fields.push('birthdays');
        } catch(e) {}
      }
      const others = entry.dates.filter(d => d.dateType !== 'birthday');
      if (others.length) {
        body.events = others.map(d => ({
          date: parseDate(d.dateStr),
          type: d.dateType === 'anniversary' ? 'anniversary' : 'custom',
          formattedType: d.label || d.dateType
        }));
        fields.push('events');
      }
      if (fields.length) {
        People.People.updateContact(body, resourceName, { updatePersonFields: fields.join(',') });
      }
    }

    // Restore sheet row if it was deleted
    if (entry.deletedRow) {
      contactsSheet.appendRow(entry.deletedRow);
    }

    // Remove from ignore list
    removeFromIgnoreList(resourceName);

    // Build a fresh card by running discovery on just this contact
    const person    = People.People.get(resourceName, { personFields: PERSON_FIELDS });
    const firstName = (person.names||[{}])[0].givenName  || entry.firstName || '';
    const lastName  = (person.names||[{}])[0].familyName || entry.lastName  || '';
    const email     = (person.emailAddresses||[])[0]?.value || entry.email   || '';
    const matchName = (person.names||[{}])[0].displayName || '';

    const contactDates = [];
    for (const b of person.birthdays||[]) {
      contactDates.push({ type:'birthday', dateStr: formatDateObj(b.date), label:'' });
    }
    for (const e of person.events||[]) {
      contactDates.push({ type: e.type||'other', dateStr: formatDateObj(e.date), label: e.formattedType||'' });
    }

    const card = {
      id:           `contact-${resourceName}`,
      type:         'new-to-sheet',
      resourceName, firstName, lastName, email, matchName, contactDates,
      confidence:   'high', how: 'restored from ignored', conflicts: [],
    };

    return { success: true, card };
  } catch(e) {
    Logger.log(`trackAgain error (${resourceName}): ${e.message}`);
    return { success: false, result: `❌ ${e.message}` };
  }
}


// ─── Rollback ─────────────────────────────────────────────────────────────────

function getRollbackTargets() {
  // Stored in script properties during this session
  const raw = PropertiesService.getScriptProperties().getProperty('rollback_targets')||'[]';
  return JSON.parse(raw);
}

function addRollbackTarget(resourceName) {
  const targets = getRollbackTargets();
  targets.push(resourceName);
  PropertiesService.getScriptProperties().setProperty('rollback_targets', JSON.stringify(targets));
}

function rollback() {
  const targets = getRollbackTargets();
  if (!targets.length) { showAlert('Nothing to roll back this session.'); return; }

  const ui  = SpreadsheetApp.getUi();
  const ans = ui.alert('Confirm Rollback',
    `Delete ${targets.length} contact(s) created this session?\n\n${targets.join('\n')}\n\nThis cannot be undone.`,
    ui.ButtonSet.YES_NO);
  if (ans!==ui.Button.YES) return;

  let deleted=0,errors=0;
  for (const rn of targets) {
    try { People.People.deleteContact(rn); deleted++; Utilities.sleep(API_DELAY_MS); }
    catch(e) { errors++; Logger.log(`Rollback error (${rn}): ${e.message}`); }
  }
  PropertiesService.getScriptProperties().deleteProperty('rollback_targets');
  showAlert(`Rollback done.\nDeleted: ${deleted}\nErrors: ${errors}`);
}


function getIgnoreListForSidebar() {
  return getIgnoreList();
}


// ─── Setup ────────────────────────────────────────────────────────────────────

function setupContactsSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTACTS_SHEET);
  if (!sheet) { showAlert(`Sheet "${CONTACTS_SHEET}" not found. Create it first.`); return; }
  const data = sheet.getDataRange().getValues();
  if (data.length<=1) { showAlert('Sheet is empty — add your data first, then run Setup.'); return; }
  const headers = ['First Name','Last Name','Email','Birthday','Date','Label'];
  sheet.getRange(1,1,1,sheet.getLastColumn()).clear();
  sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f0f4ff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1,headers.length);
  for (let c=1;c<=headers.length;c++) sheet.setColumnWidth(c,sheet.getColumnWidth(c)+24);
  showAlert('✅ Contacts sheet headers updated.');
}


// ─── UI Helper ────────────────────────────────────────────────────────────────

function showAlert(msg) {
  try { SpreadsheetApp.getUi().alert(msg); }
  catch(e) { Logger.log(msg); SpreadsheetApp.getActiveSpreadsheet().toast(msg,'📅 Important Dates Sync',15); }
}


// ─── Menu ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📅 Important Dates Sync')
    .addItem('🔍 Discover',             'openSidebar')
    .addItem('↩ Rollback Last Created', 'rollback')
    .addSeparator()
    .addItem('⚙ Setup Contacts Sheet', 'setupContactsSheet')
    .addItem('🩺 Check API Access',     'checkApiAccess')
    .addToUi();
}


// ─── Diagnostics ──────────────────────────────────────────────────────────────

function checkApiAccess() {
  try {
    People.People.searchContacts({query:'zzztest',readMask:'names'});
    showAlert('✅ People API is working.');
  } catch(e) {
    showAlert('❌ People API error:\n'+e.message+'\n\nFix: Services (+) → Add "People API" (shows as "Peopleapi").');
  }
}


// ─── Sidebar ──────────────────────────────────────────────────────────────────

function openSidebar() {
  const html = HtmlService.createHtmlOutput(getSidebarHtml())
    .setTitle('📅 Important Dates Sync')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getSidebarHtml() {
  return `<!DOCTYPE html>
<html>
<head>
<base target="_top">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Google Sans',Arial,sans-serif;font-size:13px;color:#202124;background:#f1f3f4;height:100vh}
  a{color:#1a73e8;text-decoration:none}
  a:hover{text-decoration:underline}

  #hdr{background:white;padding:12px 14px 10px;border-bottom:1px solid #e0e0e0;position:sticky;top:0;z-index:10}
  #hdr h2{font-size:14px;font-weight:600;color:#1a73e8;margin-bottom:6px}
  #hdr-row{display:flex;justify-content:space-between;align-items:center}
  #summary{display:flex;gap:5px;flex-wrap:wrap;flex:1}
  #refresh-btn{font-size:11px;padding:3px 10px;border-radius:4px;border:1px solid #dadce0;
    background:white;cursor:pointer;color:#5f6368;margin-left:8px;white-space:nowrap}
  #refresh-btn:hover{background:#f1f3f4}

  .badge{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:500;white-space:nowrap;cursor:default}
  .b-yellow{background:#fef7e0;color:#b06000}
  .b-green {background:#e6f4ea;color:#137333}
  .b-blue  {background:#e8f0fe;color:#1a73e8}
  .b-purple{background:#f3e8fd;color:#7627bb}
  .b-teal  {background:#e6f4f4;color:#007b83}
  .b-grey  {background:#f1f3f4;color:#5f6368;border:1px solid #e0e0e0}

  #content{padding:10px;overflow-y:auto}

  .section{margin-bottom:14px}
  .sec-hd{font-size:11px;font-weight:600;color:#5f6368;text-transform:uppercase;
    letter-spacing:.5px;padding:0 2px 6px;display:flex;justify-content:space-between;align-items:center}

  .card{background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px 12px;margin-bottom:6px}
  .card.done{opacity:.55}
  .card-name{font-weight:600;font-size:13px}
  .card-sub{color:#5f6368;font-size:12px;margin-top:2px}
  .card-how{font-size:11px;color:#9aa0a6;margin-top:1px}
  .card-dates{font-size:11px;color:#5f6368;margin-top:4px}

  .conflict{background:#fef7e0;border-radius:4px;padding:4px 8px;font-size:11px;color:#b06000;margin-top:5px}
  .conflict::before{content:'⚠ '}
  .dup-note{background:#f3e8fd;border-radius:4px;padding:4px 8px;font-size:11px;color:#7627bb;margin-top:5px}
  .dup-note a{color:#7627bb;font-weight:500}

  .result{font-size:11px;margin-top:6px;padding:4px 8px;border-radius:4px}
  .r-ok  {background:#e6f4ea;color:#137333}
  .r-skip{background:#f1f3f4;color:#5f6368}
  .r-flag{background:#fef7e0;color:#b06000}
  .r-err {background:#fce8e6;color:#c5221f}

  .actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
  .btn{font-size:11px;padding:4px 10px;border-radius:4px;border:1px solid #dadce0;
    background:white;cursor:pointer;color:#1a73e8;font-family:inherit;transition:background .1s}
  .btn:hover:not(:disabled){background:#f0f7ff}
  .btn.p {background:#1a73e8;color:white;border-color:#1a73e8}
  .btn.p:hover:not(:disabled){background:#1557b0}
  .btn.m {color:#5f6368}
  .btn.w {color:#b06000;border-color:#f0c14b}
  .btn.batch{background:#e8f0fe;color:#1a73e8;border-color:#1a73e8;font-size:11px}
  .btn:disabled{opacity:.4;cursor:default}

  .spin{display:inline-block;width:12px;height:12px;border:2px solid #dadce0;
    border-top-color:#1a73e8;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle}
  @keyframes spin{to{transform:rotate(360deg)}}

  #loader{display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:48px 20px;gap:12px;color:#5f6368;font-size:12px;text-align:center}
  #loader .spin{width:24px;height:24px;border-width:3px}
  #loader-msg{color:#5f6368}

  .empty{text-align:center;color:#9aa0a6;padding:32px 16px;font-size:12px;line-height:1.8}
  .ignored-toggle{font-size:11px;color:#9aa0a6;cursor:pointer;padding:8px 2px;display:block;text-align:center}
  .ignored-toggle:hover{color:#5f6368}
  .profile-note{font-size:11px;color:#9aa0a6;margin-top:3px}
  .ignore-reason{font-size:11px;color:#9aa0a6;font-style:italic;margin-top:2px}
</style>
</head>
<body>

<div id="hdr">
  <h2>📅 Important Dates Sync</h2>
  <div id="hdr-row">
    <div id="summary"></div>
    <button id="refresh-btn" onclick="load()" style="display:none">↻ Re-run</button>
  </div>
</div>
<div id="content">
  <div id="loader">
    <div class="spin"></div>
    <div id="loader-msg">Searching Google Contacts…<br>This may take a moment.</div>
  </div>
</div>

<script>
let CARDS = [];

// ── Boot ─────────────────────────────────────────────────────
function load() {
  document.getElementById('summary').innerHTML = '';
  document.getElementById('refresh-btn').style.display = 'none';
  document.getElementById('content').innerHTML =
    '<div id="loader"><div class="spin"></div><div id="loader-msg">Searching Google Contacts…<br>This may take a moment.</div></div>';
  CARDS = [];
  google.script.run
    .withSuccessHandler(data => {
      if (data.error) { showErr(data.error); return; }
      CARDS = data.cards||[];
      google.script.run
        .withSuccessHandler(list => { IGNORED = list||[]; render(); })
        .withFailureHandler(() => { render(); })
        .getIgnoreListForSidebar();
      document.getElementById('refresh-btn').style.display = '';
    })
    .withFailureHandler(e => showErr(e.message))
    .getDiscoverData();
}
load();

function showErr(msg) {
  document.getElementById('content').innerHTML =
    '<div class="empty" style="color:#c5221f">❌ '+esc(msg)+'</div>';
}

// ── Helpers ───────────────────────────────────────────────────
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const isDone = c => !!(c.result&&c.result.length);
function resultClass(r) {
  if(!r) return '';
  if(r.startsWith('✅')) return 'r-ok';
  if(r.startsWith('⏭')) return 'r-skip';
  if(r.startsWith('↩')) return 'r-flag';
  return 'r-err';
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const byType = t => CARDS.filter(c=>c.type===t&&!isDone(c));
  const review   = byType('needs-review');
  const newCon   = byType('new-to-contacts');
  const newSheet = byType('new-to-sheet');
  const dupls    = byType('possible-duplicate');
  const ready    = byType('ready');
  const synced   = byType('in-sync');
  const done     = CARDS.filter(c=>isDone(c));

  const badges = [
    review.length   ? \`<span class="badge b-yellow">\${review.length} review</span>\`     : '',
    newCon.length   ? \`<span class="badge b-blue">\${newCon.length} new →contacts</span>\` : '',
    newSheet.length ? \`<span class="badge b-teal">\${newSheet.length} new →sheet</span>\`  : '',
    dupls.length    ? \`<span class="badge b-purple">\${dupls.length} duplicates</span>\`   : '',
    ready.length    ? \`<span class="badge b-green">\${ready.length} ready</span>\`          : '',
    synced.length   ? \`<span class="badge b-grey">\${synced.length} in sync</span>\`        : '',
    done.length     ? \`<span class="badge b-grey">\${done.length} done</span>\`             : '',
  ];
  document.getElementById('summary').innerHTML = badges.filter(Boolean).join('');

  const con = document.getElementById('content');
  con.innerHTML = '';

  if (!CARDS.length) {
    con.innerHTML = '<div class="empty">No data found.<br>Add rows to your Contacts sheet and try again.</div>';
    return;
  }

  const allDone = !review.length&&!newCon.length&&!newSheet.length&&!dupls.length&&!ready.length&&!synced.length;
  if (allDone) {
    con.innerHTML = '<div class="empty">🎉 All done!<br>Click <b>↻ Re-run</b> to check for changes.</div>';
    return;
  }

  if (review.length)   con.appendChild(makeSection('⚠️ Needs Review',       review,   'needs-review'));
  if (newCon.length)   con.appendChild(makeSection('➕ New to Contacts',     newCon,   'new-to-contacts'));
  if (newSheet.length) con.appendChild(makeSection('📥 New to Sheet',        newSheet, 'new-to-sheet'));
  if (dupls.length)    con.appendChild(makeSection('⚠️ Possible Duplicate',  dupls,    'possible-duplicate'));
  if (ready.length)    con.appendChild(makeSection('✅ Ready to Sync',       ready,    'ready'));
  if (synced.length)   con.appendChild(makeSection('✓ Already in Sync',      synced,   'in-sync'));
  if (done.length)     con.appendChild(makeSection('✓ Done',                 done,     'done'));
  if (IGNORED.length)  con.appendChild(makeIgnoredSection(IGNORED));
}

// ── Section ───────────────────────────────────────────────────
function makeSection(title, cards, type) {
  const el=document.createElement('div'); el.className='section';
  const hd=document.createElement('div'); hd.className='sec-hd';
  hd.innerHTML=\`<span>\${title}</span>\`;
  if (type==='ready'&&cards.length>1) {
    const b=document.createElement('button'); b.className='btn batch'; b.textContent='Sync All';
    b.onclick=()=>syncAll(cards,b); hd.appendChild(b);
  }
  if (type==='new-to-sheet'&&cards.length>1) {
    const b=document.createElement('button'); b.className='btn batch'; b.textContent='Import All';
    b.onclick=()=>importAll(cards,b); hd.appendChild(b);
  }
  el.appendChild(hd);
  cards.forEach(c=>el.appendChild(makeCard(c,type)));
  return el;
}

// ── Card ──────────────────────────────────────────────────────
function makeCard(card, type) {
  const el=document.createElement('div');
  el.className='card'+(isDone(card)?' done':'');
  el.id='card-'+card.id;

  const name=[card.firstName,card.lastName].filter(Boolean).join(' ')||card.matchName||'?';
  let html=\`<div class="card-name">\${esc(name)}</div>\`;

  // Subtext
  if (card.matchName&&type!=='new-to-contacts'&&type!=='new-to-sheet'&&type!=='possible-duplicate') {
    html+=\`<div class="card-sub">→ \${esc(card.matchName)}</div>\`;
    html+=\`<div class="card-how">\${esc(card.how||'')}</div>\`;
  }
  if (type==='new-to-contacts') {
    html+=\`<div class="card-sub" style="color:#9aa0a6">Not found in Google Contacts</div>\`;
  }
  if (type==='new-to-sheet'||type==='possible-duplicate') {
    const dates=(card.contactDates||[]).map(d=>d.type==='birthday'
      ? \`🎂 \${d.dateStr}\`
      : \`📅 \${d.dateStr}\${d.label?' ('+d.label+')':''}\`
    ).join(' · ');
    if(dates) html+=\`<div class="card-dates">\${esc(dates)}</div>\`;
  }

  // Conflicts
  (card.conflicts||[]).forEach(c=>{html+=\`<div class="conflict">\${esc(c)}</div>\`;});

  // Duplicate note
  if (type==='possible-duplicate'&&card.similarTo) {
    html+=\`<div class="dup-note">Similar to "<b>\${esc(card.similarTo)}</b>" in your sheet.
      Consider <a href="https://contacts.google.com" target="_blank">merging in Google Contacts</a> first.</div>\`;
  }

  // Result
  if (isDone(card)) {
    html+=\`<div class="result \${resultClass(card.result)}">\${esc(card.result)}</div>\`;
  }

  el.innerHTML=html;
  if (!isDone(card)) el.appendChild(makeActions(card,type));
  return el;
}

// ── Action buttons ────────────────────────────────────────────
function makeActions(card, type) {
  const div=document.createElement('div'); div.className='actions'; div.id='act-'+card.id;

  const btn=(label,action,cls,actionData)=>{
    const b=document.createElement('button'); b.className='btn '+(cls||''); b.textContent=label;
    b.onclick=()=>run(card,action,div,actionData); return b;
  };

  const ignoreBtn = () => btn('Ignore','ignore','m');
  const untrackBtn = () => {
    const b=document.createElement('button'); b.className='btn w'; b.textContent='Untrack';
    b.onclick=()=>showUntrackMenu(card,div); return b;
  };

  if (type==='in-sync') {
    if (!card.profileBday) div.appendChild(untrackBtn());
    div.appendChild(ignoreBtn());
  } else if (type==='new-to-contacts') {
    div.appendChild(btn('Create Contact','create contact','p'));
    div.appendChild(ignoreBtn());
    div.appendChild(btn('Skip','skip','m'));
  } else if (type==='new-to-sheet'||type==='possible-duplicate') {
    div.appendChild(btn('Import to Sheet','import to sheet','p'));
    if (!card.profileBday) div.appendChild(untrackBtn());
    div.appendChild(ignoreBtn());
    div.appendChild(btn('Skip','skip','m'));
  } else if (type==='ready') {
    div.appendChild(btn('Push to Contact','push to contact','p'));
    if (!card.profileBday) div.appendChild(untrackBtn());
    div.appendChild(ignoreBtn());
    div.appendChild(btn('Skip','skip','m'));
  } else {
    // needs-review
    div.appendChild(btn('Push to Contact','push to contact','p'));
    const hasNameConflict=(card.conflicts||[]).some(c=>c.startsWith('Name'));
    // name sync removed — this is a date tracker, not a contact manager
    div.appendChild(btn('Pull from Contact','pull from contact'));
    if (!card.profileBday) div.appendChild(untrackBtn());
    div.appendChild(ignoreBtn());
    div.appendChild(btn('Wrong Match','wrong match','w'));
    div.appendChild(btn('Skip','skip','m'));
  }
  return div;
}

// ── Untrack inline menu ───────────────────────────────────────
function showUntrackMenu(card, div) {
  div.innerHTML = '';

  const events   = card.events || [];
  const hasBday  = events.some(e=>e.dateType==='birthday');
  const others   = events.filter(e=>e.dateType!=='birthday');

  const sub = (label, action, actionData) => {
    const b=document.createElement('button'); b.className='btn w'; b.textContent=label;
    b.onclick=()=>run(card, action, div, actionData); return b;
  };

  if (hasBday) div.appendChild(sub('Birthday','untrack-birthday'));

  others.forEach((evt, i) => {
    const label = evt.label || (evt.dateType==='anniversary' ? 'Anniversary' : 'Event '+(i+1));
    div.appendChild(sub(label, 'untrack-event', { eventIndex: i }));
  });

  div.appendChild(sub('All dates','untrack-all'));

  const cancel=document.createElement('button'); cancel.className='btn m'; cancel.textContent='Cancel';
  cancel.onclick=()=>{ div.innerHTML=''; div.appendChild(makeActions(card, card.type)); };
  div.appendChild(cancel);
}

// ── Run action ────────────────────────────────────────────────
function run(card, action, actDiv) {
  if(actDiv) actDiv.innerHTML='<span class="spin"></span> Working…';
  google.script.run
    .withSuccessHandler(res=>onResult(card,action,res))
    .withFailureHandler(e=>onResult(card,action,{success:false,result:'❌ '+e.message}))
    .executeCardAction(card,action);
}

function onResult(card,action,res) {
  const idx=CARDS.findIndex(c=>c.id===card.id);
  if(idx>=0){CARDS[idx].action=action;CARDS[idx].result=res.result;}
  render();
}

// ── Ignored section ──────────────────────────────────────────────
function makeIgnoredSection(entries) {
  const el  = document.createElement('div'); el.className='section'; el.id='ignored-section';
  const toggle = document.createElement('span');
  toggle.className = 'ignored-toggle';
  toggle.textContent = '▸ ' + entries.length + ' Ignored — click to expand';
  toggle.onclick = () => {
    const body = document.getElementById('ignored-body');
    const expanded = body.style.display !== 'none';
    body.style.display = expanded ? 'none' : '';
    toggle.textContent = expanded
      ? '▸ ' + entries.length + ' Ignored — click to expand'
      : '▾ ' + entries.length + ' Ignored';
  };
  el.appendChild(toggle);

  const body = document.createElement('div');
  body.id = 'ignored-body';
  body.style.display = 'none';

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'card'; card.id = 'ignored-'+entry.resourceName;
    const name = [entry.firstName,entry.lastName].filter(Boolean).join(' ')||entry.displayName||'?';
    const dates = (entry.dates||[]).map(d=>d.dateStr).join(', ');
    card.innerHTML =
      '<div class="card-name">' + esc(name) + '</div>' +
      '<div class="ignore-reason">' + esc(entry.reason||'ignored') + (dates ? ' · ' + esc(dates) : '') + '</div>';
    const actions = document.createElement('div'); actions.className='actions';
    const b = document.createElement('button'); b.className='btn p'; b.textContent='Track Again';
    b.onclick = () => {
      b.disabled = true; b.textContent='Restoring…';
      google.script.run
        .withSuccessHandler(res => {
          if (res.success) {
            IGNORED = IGNORED.filter(e=>e.resourceName!==entry.resourceName);
            if (res.card) CARDS.push(res.card);
            render();
          } else {
            b.disabled=false; b.textContent='Track Again';
            alert(res.result||'Error');
          }
        })
        .withFailureHandler(e => { b.disabled=false; b.textContent='Track Again'; alert(e.message); })
        .trackAgain(entry.resourceName);
    };
    actions.appendChild(b); card.appendChild(actions); body.appendChild(card);
  });

  el.appendChild(body);
  return el;
}

// ── Sync all ready ────────────────────────────────────────────
function syncAll(cards,btn) {
  if(btn) btn.disabled=true;
  const pending=cards.filter(c=>!isDone(c));
  function next(i) {
    if(i>=pending.length) return;
    const card=pending[i];
    google.script.run
      .withSuccessHandler(res=>{onResult(card,'push to contact',res);next(i+1);})
      .withFailureHandler(e=>{onResult(card,'push to contact',{success:false,result:'❌ '+e.message});next(i+1);})
      .executeCardAction(card,'push to contact',null);
  }
  next(0);
}

// ── Import all new-to-sheet ───────────────────────────────────
function importAll(cards,btn) {
  if(btn) btn.disabled=true;
  const pending=cards.filter(c=>!isDone(c));
  function next(i) {
    if(i>=pending.length) return;
    const card=pending[i];
    google.script.run
      .withSuccessHandler(res=>{onResult(card,'import to sheet',res);next(i+1);})
      .withFailureHandler(e=>{onResult(card,'import to sheet',{success:false,result:'❌ '+e.message});next(i+1);})
      .executeCardAction(card,'import to sheet');
  }
  next(0);
}
</script>
</body>
</html>`;
}
