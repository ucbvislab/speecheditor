
import os
import os.path
import sys
from collections import defaultdict

from pyechonest import song, track, catalog, artist

import songiters

song_ids = []
tal28 = catalog.Catalog('tal28', type='song')

# for fn in songiters.the28(ext="mp3"):
#     t = track.track_from_filename(fn)
#     
#     try:
#         print '"%s" - %s' % (t.title, t.artist)
#     except AttributeError:
#         print 'title and artist not present'
#     
#     item = [{
#         "action": "update",
#         "item": {
#             "item_id": t.id,
#             "track_id": t.id
#         }
#     }]
#     
#     tal28.update(item)
    
    # song_ids.append(t.id)
    # s = song.search(title=t.title, artist=t.artist)

moods = map(lambda x: x["name"], artist.list_terms('mood'))
styles = map(lambda x: x["name"], artist.list_terms('style'))
songs = defaultdict(list)

for mood in moods:
    res = song.search(mood=mood, limit=True, buckets=['id:%s' % (tal28.id)])
    # print mood
    for r in res:
        songs[r.title].append(mood)
        # print "  '%s' - %s" % (r.title, r.artist_name)
for song, moods in songs.iteritems():
    print "\n" + song
    print "  " + " ".join(moods)
    
    