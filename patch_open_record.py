#!/usr/bin/env python3
import sys
P = "nexus-base-frontend.html"
s = open(P, encoding="utf-8").read()
OLD = 'const r=await fetch("/api/records/"+id);const d=await r.json();if(!d.success)return;\n    const rec=d.record;const det=document.getElementById("record-detail");det.style.display="block";'
NEW = 'const r=await fetch("/api/records/"+id);const d=await r.json();if(!d.success){toast("Could not open record: "+(d.error||"unknown"),true);return;}\n    const rec=d.record;showMode("records");const det=document.getElementById("record-detail");det.style.display="block";det.scrollIntoView({behavior:"smooth"});'
if NEW.split("\n")[1] in s:
    print("[SKIP] openRecord fix already applied."); sys.exit(0)
if s.count(OLD) != 1:
    print("[FAIL] openRecord anchor not found exactly once - nothing changed."); sys.exit(1)
s = s.replace(OLD, NEW)
open(P, "w", encoding="utf-8").write(s)
print("[OK] openRecord now switches to Records view and scrolls to the detail card")
