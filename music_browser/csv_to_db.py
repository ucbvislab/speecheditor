import csv

import MySQLdb as db

import songs_db

f = open('generate_db_entries/changepoints/mfccs_long.csv', 'rU')
c = csv.reader(f)

c.next()

for row in c:
    filename = ''.join(row[0].split('-')[:-2])
    song_id = songs_db.filename_resolver(filename)
    
    if song_id is None:
        song_id = raw_input("Song ID for " + filename + ": ")
        if song_id == "p":
            continue
    
    con, cur = songs_db.get_cursor()
    
    new_row = [song_id]
    new_row.extend(row[1:])
    
    cur.execute("INSERT INTO mfccs_long(song_id,c0, c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", new_row)
    
    con.commit()
    
f.close()