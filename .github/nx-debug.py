import glob, hashlib, json, os, sqlite3, sys
out = sys.argv[1]
for name in ("typecheck", "build"):
    data = json.load(open(f"{out}/inputs-{name}.json"))
    print(name, "json shape:", type(data).__name__, list(data)[:10] if isinstance(data, dict) else len(data))
    files = data.get("files", []) if isinstance(data, dict) else data
    with open(f"{out}/files-{name}.txt", "w") as f:
        for path in sorted(files):
            digest = hashlib.sha1(open(path, "rb").read()).hexdigest() if os.path.isfile(path) else "MISSING"
            f.write(f"{digest} {path}\n")
    with open(f"{out}/inputs-{name}.txt", "w") as f:
        json.dump({k: v for k, v in data.items() if k != "files"} if isinstance(data, dict) else {}, f, indent=1)
for db in glob.glob(".nx/workspace-data/*.db"):
    c = sqlite3.connect(db)
    rows = c.execute(
        "select d.project, d.target, d.hash, h.status, h.start from task_details d"
        " left join task_history h on h.hash = d.hash order by d.project, d.target, h.start"
    ).fetchall()
    open(f"{out}/tasks.txt", "w").write("\n".join(map(str, rows)))
    print("\n".join(map(str, rows)))
