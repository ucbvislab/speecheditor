
import MySQLdb as db
import pylast

API_KEY = '4bd0daa155eaa4e5d8b60222382cd711'
SECRET_KEY = '7eb0063521bbc2cab9e291899c75d948'

network = pylast.LastFMNetwork(api_key=API_KEY, api_secret=SECRET_KEY)

con = None

q_insert_tag = "INSERT INTO tags(tag) VALUES(%s)"
q_insert_tag_ref =\
    "INSERT INTO lastfm(song_id, tag_id, weight) VALUES(%s,%s,%s)"

def rm_short_words(word):
    return ' '.join([x for x in word.split(' ') if len(x) > 2])


try:
    con = db.connect('localhost', 'srubin_mbrowse', 'qual-cipe-whak', 'srubin_musicbrowser')
    cur = con.cursor()
    cur.execute("SELECT * FROM songs")
    data = cur.fetchall()
    
    all_tags = []
    i = 0
    for d in data:
        if i % 1 == 0:
            print i
        i += 1
        song_id = d[0]
        title = d[1]
        artist = d[2]
        try:
        # if True:
            track = network.search_for_track(artist, rm_short_words(title)).\
                        get_next_page()[0]
            tags = track.get_top_tags()
            print "--", len(tags), "tags"
            add_tags_flag = True
            if len(tags) > 0:
                cur.execute("SELECT * FROM lastfm WHERE song_id = %s",\
                    (song_id))
                rows = cur.fetchall()
                if len(rows) > 0:
                    add_tags_flag = False
            if add_tags_flag:
                for x in tags:
                    tag_name = x.item.name.lower()
                    print tag_name
                    if tag_name != title.lower() and\
                        tag_name != artist.lower():
                        cur.execute("SELECT * FROM tags WHERE tag = %s",
                            (tag_name))
                        tag_rows = cur.fetchall()
                        if len(tag_rows) == 0:
                            cur.execute(q_insert_tag, (tag_name))
                            con.commit()
                            cur.execute("SELECT * FROM tags WHERE tag = %s",
                                (tag_name))
                            tag_rows = cur.fetchall()
                            tag_id = tag_rows[0][0]
                        else:
                            tag_id = tag_rows[0][0]
                        cur.execute(q_insert_tag_ref,
                            (song_id, tag_id, int(x.weight)))
                        con.commit()
                        all_tags.append(tag_name)
        except:
            print "Error'd"
            break
            
    tag_set = set(tags)
    print tag_set
    import pdb; pdb.set_trace()
    
        
except db.Error, e:
    print "Error %d: %s" % (e.args[0],e.args[1])
    
finally:
    if con:
        con.close()