
import sys
import time

import MySQLdb as db
# import echonest.audio as audio
import pyechonest
from pyechonest import song, track, artist


con = None

def rm_short_words(word):
    return ' '.join([x for x in word.split(' ') if len(x) > 2])

con = db.connect('localhost', 'srubin_mbrowse', 'qual-cipe-whak', 'srubin_musicbrowser')
cur = con.cursor()
cur.execute("SELECT * FROM songs")
data = cur.fetchall()

q_insert = "INSERT INTO echonest(song_id, en_id, mode, song_key, energy, time, danceability, tempo) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)"

for d in data:
    song_id = d[0]
    title = d[1]
    artist = d[2]
    skip_flag = False
    while True:
        try:
            cur.execute("SELECT * FROM echonest WHERE song_id = %s",
                (song_id))
            rows = cur.fetchall()
            if len(rows) == 0:
                en_song = song.search(combined=(artist + ' ' + title))
                print
                print "   %s - %s" % (artist, title)
                for i, s in enumerate(en_song):
                    print "%d: %s - %s" % (i, s.artist_name, s.title)
                idx = raw_input('index: ')
                if idx == 'p':
                    import pdb; pdb.set_trace()
                elif idx == '':
                    idx = 0
                elif idx == 's':
                    skip_flag = True
                    break
                en_song = en_song[int(idx)]
                stats = en_song.audio_summary
                en_id = en_song.id
                break
            else:
                skip_flag = True
                break
        except pyechonest.util.EchoNestAPIError:
            time.sleep(2)
    if skip_flag:
        continue
    print song_id
    print title
    print en_song
    print
    song_mode = "major"
    if stats["mode"] == 0:
        song_mode = "minor"
    song_tempo = stats["tempo"]
    song_key = stats["key"]
    song_energy = stats["energy"]
    song_time = stats["time_signature"]
    song_danceability = stats["danceability"]
    cur.execute("SELECT * FROM echonest WHERE song_id = %s", (song_id))
    rows = cur.fetchall()
    if len(rows) == 0:
        cur.execute(q_insert, (song_id, en_id, song_mode,
            song_key, song_energy,
            song_time, song_danceability, song_tempo))
        con.commit()


if con:
    con.close()
        