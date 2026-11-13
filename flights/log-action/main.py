"""
BDR Terminal (gamified) - log actions from the terminal Dive (MotherDuck only, never HubSpot).

Two input modes:
  * BATCH: JSON array (max 50) of {event_id, event_type, contact_id?, company_id?, ae_id?, retouch_days?, note?, payload?}
    -> one Flight run saves many clicks (the Dive queues actions and flushes them together).
  * Single: EVENT_ID / EVENT_TYPE / CONTACT_ID / ... env vars (backward compatible).
Rules:
  * Contact actions: only the contact's queue-owner BDR (HubSpot contact owner, or deal bdr_owner).
  * ae_assign: only a BDR who owns at least one contact at that company.
  * draft_saved: payload JSON (subject/body/...) stored as-is after key filtering.
  * Idempotent on event_id. Inputs are untrusted and validated; SQL is parameterized.
  * Valid events are written even if others in the batch are rejected; exit code 2 if any were rejected.
"""
import json
import os
import re
import sys
from datetime import date, timedelta

import duckdb

DB = "bdr_terminal_gamified"
MDW_SHARE = "md:_share/mdw/8cdbf94d-7075-45a4-bf57-4fd19470e532"
CONTACT_EVENTS = {
    "reviewed", "retouch_set", "retouch_clear", "note", "draft_saved",
    "linkedin_request_sent", "linkedin_accepted", "linkedin_message", "linkedin_reply",
}
ACCOUNT_EVENTS = {"ae_assign"}
PAYLOAD_KEYS = {"template_id", "subject", "body", "ai_subject", "ai_body", "edited", "opened_in_gmail", "cc", "flags"}


def validate(e: dict):
    """Return (row_dict, None) or (None, reason)."""
    eid = str(e.get("event_id", "")).strip()
    et = str(e.get("event_type", "")).strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", eid):
        return None, "bad event_id"
    if et not in CONTACT_EVENTS | ACCOUNT_EVENTS:
        return None, f"unknown event_type {et!r}"
    row = {"event_id": eid, "event_type": et, "contact_id": None, "company_id": None,
           "retouch_on": None, "note": None, "payload": None}
    if et in ACCOUNT_EVENTS:
        co = str(e.get("company_id", "")).strip()
        ae = str(e.get("ae_id", "")).strip()
        if not re.fullmatch(r"\d{1,20}", co):
            return None, "bad company_id"
        if ae and not re.fullmatch(r"\d{5,12}", ae):
            return None, "bad ae_id"
        row["company_id"], row["note"] = int(co), (ae or None)
        return row, None
    ct = str(e.get("contact_id", "")).strip()
    if not re.fullmatch(r"\d{1,20}", ct):
        return None, "bad contact_id"
    row["contact_id"] = int(ct)
    note = str(e.get("note", "") or "")[:2000]
    if et == "retouch_set":
        d = str(e.get("retouch_days", "")).strip()
        if not re.fullmatch(r"\d{1,3}", d) or not (1 <= int(d) <= 180):
            return None, "retouch_days must be 1-180"
        row["retouch_on"] = date.today() + timedelta(days=int(d))
    if et == "note" and not note.strip():
        return None, "empty note"
    if et == "draft_saved":
        p = e.get("payload")
        if isinstance(p, str):
            try:
                p = json.loads(p)
            except Exception:
                return None, "payload not JSON"
        if not isinstance(p, dict) or not str(p.get("body", "")).strip():
            return None, "payload needs a body"
        p = {k: p[k] for k in p if k in PAYLOAD_KEYS}
        s = json.dumps(p)
        if len(s) > 20000:
            return None, "payload too large"
        row["payload"] = s
        note = str(p.get("subject", ""))[:300]
    row["note"] = note or None
    return row, None


def main():
    actor = os.environ.get("ACTOR_BDR_ID", "").strip()
    if not re.fullmatch(r"\d{5,12}", actor):
        print("REJECTED: ACTOR_BDR_ID missing or malformed", flush=True)
        sys.exit(2)

    raw_batch = os.environ.get("BATCH", "").strip()
    if raw_batch:
        try:
            events = json.loads(raw_batch)
        except Exception:
            print("REJECTED: BATCH is not valid JSON", flush=True)
            sys.exit(2)
        if not isinstance(events, list) or not (1 <= len(events) <= 50):
            print("REJECTED: BATCH must be a list of 1-50 events", flush=True)
            sys.exit(2)
    else:
        events = [{
            "event_id": os.environ.get("EVENT_ID", ""), "event_type": os.environ.get("EVENT_TYPE", ""),
            "contact_id": os.environ.get("CONTACT_ID", ""), "company_id": os.environ.get("COMPANY_ID", ""),
            "ae_id": os.environ.get("AE_ID", ""), "retouch_days": os.environ.get("RETOUCH_DAYS", ""),
            "note": os.environ.get("NOTE", ""), "payload": os.environ.get("PAYLOAD", ""),
        }]

    rejected, rows = [], []
    for e in events:
        if not isinstance(e, dict):
            rejected.append(("?", "not an object"))
            continue
        row, err = validate(e)
        if err:
            rejected.append((str(e.get("event_id", "?")), err))
        else:
            rows.append(row)

    con = duckdb.connect(f"md:{DB}?attach_mode=single")
    if rows:
        con.execute(f"ATTACH IF NOT EXISTS '{MDW_SHARE}' AS mdw")
        contact_ids = sorted({str(r["contact_id"]) for r in rows if r["contact_id"] is not None})
        company_ids = sorted({str(r["company_id"]) for r in rows if r["company_id"] is not None})
        owned_contacts, owned_companies = set(), set()
        if contact_ids:
            owned_contacts = {x[0] for x in con.execute(
                """
                SELECT hs_object_id FROM mdw.hubspot.contacts WHERE hs_object_id IN (SELECT unnest(?)) AND hubspot_owner_id = ?
                UNION
                SELECT dca.contact_id::VARCHAR FROM mdw.hubspot.deal_to_contact_associations dca
                JOIN mdw.hubspot.deals d ON d.hs_object_id::VARCHAR = dca.deal_id::VARCHAR
                WHERE dca.contact_id::VARCHAR IN (SELECT unnest(?)) AND d.bdr_owner = ?
                """, [contact_ids, actor, contact_ids, actor]).fetchall()}
        if company_ids:
            owned_companies = {x[0] for x in con.execute(
                "SELECT DISTINCT associatedcompanyid FROM mdw.hubspot.contacts WHERE associatedcompanyid IN (SELECT unnest(?)) AND hubspot_owner_id = ?",
                [company_ids, actor]).fetchall()}
        ok_rows = []
        for r in rows:
            if r["contact_id"] is not None and str(r["contact_id"]) not in owned_contacts:
                rejected.append((r["event_id"], f"not queue owner of contact {r['contact_id']}"))
            elif r["company_id"] is not None and str(r["company_id"]) not in owned_companies:
                rejected.append((r["event_id"], f"owns no contacts at company {r['company_id']}"))
            else:
                ok_rows.append(r)
        if ok_rows:
            con.executemany(
                """INSERT OR IGNORE INTO main.touch_events
                   (event_id, actor_bdr_id, contact_id, company_id, event_type, retouch_on, note, payload, source)
                   VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), 'dive')""",
                [[r["event_id"], actor, r["contact_id"], r["company_id"], r["event_type"], r["retouch_on"], r["note"], r["payload"]]
                 for r in ok_rows],
            )
        print(f"OK saved {len(ok_rows)} event(s) for actor={actor}", flush=True)

    for eid, why in rejected:
        print(f"REJECTED: {eid}: {why}", flush=True)
    if rejected:
        sys.exit(2)


if __name__ == "__main__":
    main()
