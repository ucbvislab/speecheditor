import sys
import simplejson as json

from songs_db import filename_resolver

browser_file = json.load(open(sys.argv[1], "r"))

data = browser_file["aaData"]

out = []

for d in data:
    d["song_id"] = filename_resolver(d["artist"] + ' ' + d["title"])
    out.append(d)

final_out = {
    "aaData": out
}

print json.dumps(final_out)