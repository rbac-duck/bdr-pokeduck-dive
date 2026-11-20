"""
BDR Pokeduck - score inbound lead workability (MotherDuck only, never HubSpot).

Writes bdr_terminal_gamified.main.lead_workability, one row per inbound lead (MQL+ definition below),
which the dive LEFT JOINs on contact_id. Runs hourly.

Lead      = mdw.hubspot.contacts with lifecyclestage NOT IN ('lead','') AND NOT NULL, hs_marketable_status = 'true',
            email not @motherduck.com.
Inbound   = not Apollo-sourced, not on an Outbound-source deal, calc_first_conversion <> 'Outbound / Prospecting'.
Rules (first match wins; red = not a BDR lead, amber = still worth a look):
  1 AGENT_OR_RELAY_EMAIL        red    email domain in main.relay_domains (editable table)
  2 JOINED_EXISTING_ORG         red    earliest MotherDuck user for the email did not create their org
  3 NEW_TEAM_AT_PAYING_CUSTOMER red    created their org, but an older org on the same work domain has AWR > 0
  4 NON_TECHNICAL               red    role_label = non_technical
  5 INSUFFICIENT_INFO           red    role_label = unknown
  6 TECH_NO_EMPLOYER            amber  role_label = tech_no_company
  7 NO_MD_USER_MATCH            amber  role looks good, but no MotherDuck user has this email
  WORKABLE                             role_label icp / tech_at_company and none of the above
  PENDING                              no role label yet (not scored) and rules 1-3 don't match
role_label comes from prompt_jev, which is not fully deterministic, so a contact is only re-scored when its
prompt input (title, company, email domain, LinkedIn found) or email changes, or RULES_VERSION goes up.
A BDR override (touch_events.event_type = 'role_override', note = label) replaces the model's label.
"""
import os
import sys
import time
from datetime import datetime, timezone

import duckdb

DB = "bdr_terminal_gamified"
MDW_SHARE = "md:_share/mdw/8cdbf94d-7075-45a4-bf57-4fd19470e532"
RULES_VERSION = 1
SEED_RELAY = [
    ("agentmail.to", "AI agent inboxes (agentmail.to gives agents their own email)"),
    ("pm.me", "Proton relay alias"),
    ("privaterelay.appleid.com", "Hide My Email relay"),
    ("duck.com", "DuckDuckGo email protection relay"),
    ("70077007.xyz", "Disposable / agent signups seen Nov 2026"),
]
PERSONAL = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "qq.com", "163.com",
            "proton.me", "protonmail.com", "live.com", "me.com", "googlemail.com"]
INSTRUCTION = ("Classify this new signup for a cloud data warehouse (MotherDuck, built on DuckDB). "
               "Judge only from the job title, company and email domain given.")
CHOICES = """[
  {label: 'icp', description: 'data, analytics, data eng, ML/AI or software eng role, or a technical leader (CTO, VP Eng, head of data), at a real company with a work domain or a named employer'},
  {label: 'tech_at_company', description: 'technical but less clearly data/software (IT, product, technical founder, consultant at a firm)'},
  {label: 'tech_no_company', description: 'data/software person with no real employer (personal email, student, hobbyist, freelancer)'},
  {label: 'non_technical', description: 'sales, marketing, HR, finance, ops'},
  {label: 'unknown', description: 'not enough info'}
]"""
ROLE_LABELS = ("icp", "tech_at_company", "tech_no_company", "non_technical", "unknown")


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ev(node, status, **f):
    def q(v):
        s = str(v)
        return '"' + s.replace('"', "'") + '"' if (" " in s or "=" in s or '"' in s) else s
    extra = "".join(f" {k}={q(v)}" for k, v in f.items())
    print(f"@flight-run {node} {status} ts={now()}{extra}", flush=True)


def money(x):
    return (f"CASE WHEN {x} >= 1e6 THEN '$' || round({x} / 1e6, 1) || 'M' WHEN {x} >= 1000 THEN '$' || round({x} / 1000, 1) || 'K' "
            f"ELSE '$' || round({x})::BIGINT END")


def main():
    lookback = int(os.environ.get("LOOKBACK_DAYS", "95") or 95)
    max_score = int(os.environ.get("MAX_SCORE", "30000") or 30000)
    batch = int(os.environ.get("BATCH_SIZE", "2000") or 2000)
    if not (1 <= lookback <= 400 and 0 <= max_score <= 100000 and 50 <= batch <= 10000):
        print("REJECTED: LOOKBACK_DAYS 1-400, MAX_SCORE 0-100000, BATCH_SIZE 50-10000", flush=True)
        sys.exit(2)
    personal_sql = ", ".join(f"'{d}'" for d in PERSONAL)

    ev("setup", "running")
    con = duckdb.connect(f"md:{DB}?attach_mode=single")
    con.execute(f"ATTACH IF NOT EXISTS '{MDW_SHARE}' AS mdw")
    con.execute("CREATE SCHEMA IF NOT EXISTS lw_stage")
    con.execute("""CREATE TABLE IF NOT EXISTS main.relay_domains (
        domain VARCHAR PRIMARY KEY, note VARCHAR, added_at TIMESTAMP DEFAULT current_timestamp)""")
    if con.execute("SELECT count(*) FROM main.relay_domains").fetchone()[0] == 0:
        con.executemany("INSERT OR IGNORE INTO main.relay_domains (domain, note) VALUES (?, ?)", SEED_RELAY)
    con.execute("""CREATE TABLE IF NOT EXISTS main.lead_workability (
        contact_id BIGINT PRIMARY KEY, created_ts TIMESTAMP, inbound BOOLEAN, lead_source VARCHAR,
        email_domain VARCHAR, has_title BOOLEAN, has_company BOOLEAN, li_found BOOLEAN,
        reason VARCHAR, severity VARCHAR, evidence VARCHAR,
        role_label VARCHAR, role_confidence DOUBLE, role_override VARCHAR, role_input_hash VARCHAR, role_rules_version INTEGER, scored_at TIMESTAMP,
        is_relay BOOLEAN, has_md_user BOOLEAN, user_id VARCHAR, user_created_ts TIMESTAMP,
        org_id VARCHAR, org_name VARCHAR, org_users INTEGER, org_awr DOUBLE, is_org_creator BOOLEAN,
        sibling_paying BOOLEAN, sibling_org_name VARCHAR, sibling_awr DOUBLE, company_on_md BOOLEAN, company_on_md_org VARCHAR,
        agent_harness BOOLEAN, batch_signup BOOLEAN, batch_size INTEGER,
        facts_at TIMESTAMP, rules_version INTEGER)""")
    ev("setup", "ok", effect="table:bdr_terminal_gamified.main.lead_workability")

    # 1) inbound leads in the lookback window, with the exact prompt input
    ev("leads", "running")
    con.execute(f"""
      CREATE OR REPLACE TABLE lw_stage.leads AS
      WITH ob AS (
        SELECT DISTINCT dca.contact_id::VARCHAR AS cid FROM mdw.hubspot.deal_to_contact_associations dca
        JOIN mdw.hubspot.deals d ON d.hs_object_id::VARCHAR = dca.deal_id::VARCHAR WHERE d.deal_source_type = 'Outbound'),
      l AS (
        SELECT c.hs_object_id::BIGINT AS contact_id, TRY_CAST(c.createdate AS TIMESTAMP) AS created_ts, lower(trim(c.email)) AS email,
          split_part(lower(trim(c.email)), '@', 2) AS dom, NULLIF(trim(c.jobtitle), '') AS title, NULLIF(trim(c.company), '') AS company,
          COALESCE(NULLIF(trim(c.linkedin_url), ''), NULLIF(trim(c.cr_linkedin_username), '')) IS NOT NULL AS li_found,
          c.calc_first_conversion AS lead_source
        FROM mdw.hubspot.contacts c
        WHERE c.lifecyclestage NOT IN ('lead', '') AND c.lifecyclestage IS NOT NULL AND c.hs_marketable_status = 'true'
          AND c.email NOT LIKE '%@motherduck.com'
          AND COALESCE(c.contact_source_label, '') <> 'Apollo' AND COALESCE(c.hs_object_source_detail_1, '') <> 'Apollo Integration'
          AND COALESCE(c.calc_first_conversion, '') <> 'Outbound / Prospecting'
          AND c.hs_object_id::VARCHAR NOT IN (SELECT cid FROM ob)
          AND TRY_CAST(c.createdate AS TIMESTAMP) >= now()::TIMESTAMP - INTERVAL ({lookback}) DAY)
      SELECT *, 'Job title: ' || COALESCE(title, '(none)') || ' | Company: ' || COALESCE(company, '(none)') || ' | Email domain: ' || dom
          || ' | LinkedIn profile found: ' || CASE WHEN li_found THEN 'yes' ELSE 'no' END AS inp,
        md5('Job title: ' || COALESCE(title, '(none)') || ' | Company: ' || COALESCE(company, '(none)') || ' | Email domain: ' || dom
          || ' | LinkedIn profile found: ' || CASE WHEN li_found THEN 'yes' ELSE 'no' END || ' | ' || COALESCE(email, '')) AS input_hash
      FROM l""")
    n_leads = con.execute("SELECT count(*) FROM lw_stage.leads").fetchone()[0]
    ev("leads", "ok", rows=n_leads, effect="table:mdw.hubspot.contacts")

    # 2) MotherDuck user / org / AWR facts (cheap, recomputed every run)
    ev("facts", "running")
    con.execute(f"""
      CREATE OR REPLACE TABLE lw_stage.facts AS
      WITH cu AS (
        SELECT id::VARCHAR AS id, lower(email) AS email, split_part(lower(email), '@', 2) AS dom, organization_id, org_creator, created_ts
        FROM mdw.main.current_users
        WHERE email IS NOT NULL AND NOT COALESCE(is_service_account, false) AND NOT COALESCE(is_anonymous_agent, false)),
      u AS (
        SELECT email, arg_min(id, created_ts) AS user_id, arg_min(organization_id, created_ts) AS org_id,
          arg_min(org_creator, created_ts) AS is_org_creator, min(created_ts) AS user_ts
        FROM cu WHERE email IN (SELECT email FROM lw_stage.leads) GROUP BY 1),
      awr AS (
        SELECT organization_id, sum(awr) AS awr FROM mdw.computed.daily_organization_awr
        WHERE is_full_day AND has_revenue
          AND dt = (SELECT max(dt) FROM mdw.computed.daily_organization_awr WHERE is_full_day AND has_revenue)
        GROUP BY 1),
      org AS (
        SELECT o.id, COALESCE(NULLIF(o.friendly_name, ''), o.name) AS org_name, o.user_count, COALESCE(a.awr, 0) AS awr
        FROM mdw.main.current_organizations o LEFT JOIN awr a ON a.organization_id = o.id),
      dorg AS (
        SELECT dom, organization_id, min(created_ts) AS first_ts FROM cu
        WHERE dom IN (SELECT dom FROM lw_stage.leads) AND dom NOT IN ({personal_sql})
          AND dom NOT IN (SELECT domain FROM main.relay_domains) GROUP BY 1, 2),
      base AS (
        SELECT l.contact_id, l.dom, u.user_id, u.org_id::VARCHAR AS org_id, u.org_id AS org_uuid, u.is_org_creator, u.user_ts,
          o.org_name, o.user_count AS org_users, COALESCE(o.awr, 0) AS org_awr,
          l.dom IN (SELECT domain FROM main.relay_domains) AS is_relay
        FROM lw_stage.leads l LEFT JOIN u ON u.email = l.email LEFT JOIN org o ON o.id = u.org_id),
      sib AS (
        SELECT b.contact_id, max(so.awr) AS sib_awr, arg_max(so.org_name, so.awr) AS sib_name, arg_max(so.org_name, so.user_count) AS any_name
        FROM base b
        JOIN dorg d ON d.dom = b.dom AND d.organization_id <> b.org_uuid AND d.first_ts < b.user_ts
        JOIN org so ON so.id = d.organization_id
        GROUP BY 1),
      mh AS (
        SELECT user_id::VARCHAR AS user_id, min(ts) AS first_ts, arg_min(user_agent, ts) AS first_ua
        FROM mdw.ai.mcp_server_events
        WHERE ts >= now()::TIMESTAMP - INTERVAL ({lookback + 2}) DAY
          AND user_id::VARCHAR IN (SELECT user_id FROM base WHERE user_id IS NOT NULL)
        GROUP BY 1),
      bt AS (
        SELECT b.contact_id, count(*) AS n
        FROM base b JOIN cu ON cu.dom = b.dom AND cu.created_ts BETWEEN b.user_ts - INTERVAL 10 MINUTE AND b.user_ts + INTERVAL 10 MINUTE
        WHERE b.dom NOT IN ({personal_sql}) AND NOT b.is_relay AND b.user_ts IS NOT NULL
        GROUP BY 1)
      SELECT b.* EXCLUDE (org_uuid), COALESCE(s.sib_awr, 0) AS sibling_awr, s.sib_name AS sibling_org_name, s.any_name AS company_on_md_org,
        (b.is_org_creator AND COALESCE(s.sib_awr, 0) > 0) AS sibling_paying,
        (b.is_org_creator AND s.contact_id IS NOT NULL AND COALESCE(s.sib_awr, 0) = 0) AS company_on_md,
        COALESCE(mh.first_ua LIKE 'agent-harness/%' AND mh.first_ts <= b.user_ts + INTERVAL 1 DAY, false) AS agent_harness,
        COALESCE(bt.n, 0) AS batch_size, COALESCE(bt.n, 0) >= 5 AS batch_signup
      FROM base b LEFT JOIN sib s USING (contact_id) LEFT JOIN mh ON mh.user_id = b.user_id LEFT JOIN bt USING (contact_id)""")
    fx = con.execute("""SELECT count(*) FILTER (WHERE is_relay), count(*) FILTER (WHERE is_org_creator = false),
        count(*) FILTER (WHERE sibling_paying), count(*) FILTER (WHERE user_id IS NULL) FROM lw_stage.facts""").fetchone()
    print(f"@flight-log facts relay={fx[0]} joined_existing_org={fx[1]} new_team_at_paying={fx[2]} no_md_user={fx[3]}", flush=True)
    ev("facts", "ok", rows=n_leads, effect="table:mdw.main.current_users")

    # 3) which leads need a (re)score: new, input changed, or rules_version went up. Newest first, capped per run.
    ev("pick", "running")
    con.execute(f"""
      CREATE OR REPLACE TABLE lw_stage.to_score AS
      SELECT l.contact_id, l.inp, l.input_hash FROM lw_stage.leads l
      LEFT JOIN main.lead_workability w ON w.contact_id = l.contact_id
      WHERE w.role_label IS NULL OR w.role_input_hash IS DISTINCT FROM l.input_hash OR COALESCE(w.role_rules_version, 0) < {RULES_VERSION}
      ORDER BY l.created_ts DESC LIMIT {max_score}""")
    total = con.execute("SELECT count(*) FROM lw_stage.to_score").fetchone()[0]
    ev("pick", "ok", rows=total)

    # 4) classify roles with prompt_jev, in batches so progress shows and a failure keeps earlier batches
    con.execute("""CREATE OR REPLACE TABLE lw_stage.roles (contact_id BIGINT, input_hash VARCHAR, role_label VARCHAR,
        role_confidence DOUBLE, scored_at TIMESTAMP)""")
    ev("classify", "running", done=0, total=total)
    done, off = 0, 0
    while off < total:
        t0 = time.time()
        con.execute(f"""
          INSERT INTO lw_stage.roles
          WITH b AS (SELECT * FROM lw_stage.to_score ORDER BY contact_id LIMIT {batch} OFFSET {off}),
          c AS MATERIALIZED (SELECT contact_id, input_hash, prompt_jev(inp, '{INSTRUCTION}', choice := {CHOICES}) AS r FROM b)
          SELECT contact_id, input_hash, r.choice, r.confidence, now()::TIMESTAMP FROM c""")
        size = min(batch, total - off)
        off += batch
        done = min(off, total)
        print(f"@flight-run classify running ts={now()} done={done} total={total}", flush=True)
        print(f"@flight-log classify batch of {size} in {time.time() - t0:.1f}s", flush=True)
    ev("classify", "ok", done=done, total=total, rows=done)

    # 5) write: facts for every lead in the window + cached or fresh role + latest BDR override -> reason
    ev("write", "running")
    con.execute(f"""
      INSERT OR REPLACE INTO main.lead_workability
      WITH ovr AS (
        SELECT contact_id, arg_max(note, event_ts) AS lbl FROM main.touch_events
        WHERE event_type = 'role_override' AND contact_id IS NOT NULL GROUP BY 1),
      r AS (
        SELECT l.*, f.* EXCLUDE (contact_id, dom),
          COALESCE(n.role_label, CASE WHEN w.role_input_hash = l.input_hash THEN w.role_label END) AS m_label,
          COALESCE(n.role_confidence, CASE WHEN w.role_input_hash = l.input_hash THEN w.role_confidence END) AS m_conf,
          COALESCE(n.scored_at, CASE WHEN w.role_input_hash = l.input_hash THEN w.scored_at END) AS m_at,
          CASE WHEN n.contact_id IS NOT NULL THEN {RULES_VERSION} WHEN w.role_input_hash = l.input_hash THEN w.role_rules_version END AS m_ver,
          CASE WHEN n.contact_id IS NOT NULL OR w.role_input_hash = l.input_hash THEN l.input_hash END AS m_hash,
          CASE WHEN o.lbl IN {ROLE_LABELS} THEN o.lbl END AS ovr
        FROM lw_stage.leads l JOIN lw_stage.facts f USING (contact_id)
        LEFT JOIN lw_stage.roles n USING (contact_id)
        LEFT JOIN main.lead_workability w USING (contact_id)
        LEFT JOIN ovr o USING (contact_id)),
      z AS (
        SELECT *, COALESCE(ovr, m_label) AS eff,
          CASE WHEN is_relay THEN 'AGENT_OR_RELAY_EMAIL'
               WHEN is_org_creator = false THEN 'JOINED_EXISTING_ORG'
               WHEN sibling_paying THEN 'NEW_TEAM_AT_PAYING_CUSTOMER'
               WHEN COALESCE(ovr, m_label) IS NULL THEN 'PENDING'
               WHEN COALESCE(ovr, m_label) = 'non_technical' THEN 'NON_TECHNICAL'
               WHEN COALESCE(ovr, m_label) = 'unknown' THEN 'INSUFFICIENT_INFO'
               WHEN COALESCE(ovr, m_label) = 'tech_no_company' THEN 'TECH_NO_EMPLOYER'
               WHEN user_id IS NULL THEN 'NO_MD_USER_MATCH'
               ELSE 'WORKABLE' END AS rsn,
          concat_ws(', ', COALESCE('"' || title || '"', 'No title'), COALESCE(company, 'no company'), dom) AS who
        FROM r)
      SELECT contact_id, created_ts, true, lead_source, dom, title IS NOT NULL, company IS NOT NULL, li_found,
        rsn,
        CASE WHEN rsn IN ('AGENT_OR_RELAY_EMAIL', 'JOINED_EXISTING_ORG', 'NEW_TEAM_AT_PAYING_CUSTOMER', 'NON_TECHNICAL', 'INSUFFICIENT_INFO') THEN 'red'
             WHEN rsn IN ('TECH_NO_EMPLOYER', 'NO_MD_USER_MATCH') THEN 'amber' WHEN rsn = 'WORKABLE' THEN 'none' END,
        CASE rsn
          WHEN 'AGENT_OR_RELAY_EMAIL' THEN 'Email on ' || dom || ' (relay or agent inbox domain)'
          WHEN 'JOINED_EXISTING_ORG' THEN 'Joined ' || COALESCE(org_name, 'an existing org') || ' (' || COALESCE(org_users, 0) || ' users, '
               || CASE WHEN org_awr > 0 THEN {money('org_awr')} || ' AWR)' ELSE 'free org)' END
          WHEN 'NEW_TEAM_AT_PAYING_CUSTOMER' THEN 'New org, but ' || COALESCE(sibling_org_name, 'another org') || ' on ' || dom || ' pays ' || {money('sibling_awr')} || ' AWR'
          WHEN 'NO_MD_USER_MATCH' THEN who || ', no MotherDuck user with this email'
          ELSE who END,
        m_label, m_conf, ovr, m_hash, m_ver, m_at,
        is_relay, user_id IS NOT NULL, user_id, user_ts, org_id, org_name, org_users, org_awr, is_org_creator,
        sibling_paying, sibling_org_name, sibling_awr, company_on_md, company_on_md_org, agent_harness, batch_signup, batch_size,
        now()::TIMESTAMP, {RULES_VERSION}
      FROM z""")
    summ = con.execute("""SELECT reason, count(*) FROM main.lead_workability
        WHERE contact_id IN (SELECT contact_id FROM lw_stage.leads) GROUP BY 1 ORDER BY 2 DESC""").fetchall()
    print("@flight-log write " + " ".join(f"{r}={n}" for r, n in summ), flush=True)
    ev("write", "ok", rows=n_leads, effect="table:bdr_terminal_gamified.main.lead_workability")

    ev("cleanup", "running")
    for t in ("leads", "facts", "to_score", "roles"):
        con.execute(f"DROP TABLE IF EXISTS lw_stage.{t}")
    ev("cleanup", "ok")


if __name__ == "__main__":
    try:
        main()
        print("@flight-run @flight ok exit=0", flush=True)
    except SystemExit:
        raise
    except Exception:
        print("@flight-run @flight failed exit=1", flush=True)
        raise
