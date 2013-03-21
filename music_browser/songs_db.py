"""
Functions that cover tasks involving the database
"""

import os

import MySQLdb as db
import numpy as N

from lastfm_tag_categories import lastfm_tag_categories as tag_categories


field_type = {
    0: 'DECIMAL',
    1: 'TINY',
    2: 'SHORT',
    3: 'LONG',
    4: 'FLOAT',
    5: 'DOUBLE',
    6: 'NULL',
    7: 'TIMESTAMP',
    8: 'LONGLONG',
    9: 'INT24',
    10: 'DATE',
    11: 'TIME',
    12: 'DATETIME',
    13: 'YEAR',
    14: 'NEWDATE',
    15: 'VARCHAR',
    16: 'BIT',
    246: 'NEWDECIMAL',
    247: 'INTERVAL',
    248: 'SET',
    249: 'TINY_BLOB',
    250: 'MEDIUM_BLOB',
    251: 'LONG_BLOB',
    252: 'BLOB',
    253: 'VAR_STRING',
    254: 'STRING',
    255: 'GEOMETRY'
}


def filename_resolver(filename):
    import sphinxapi
    """filename --> database id (songs table)"""

    fileName, fileExtension = os.path.splitext(filename)
    lastPart = fileName.split('/')[-1]

    client = sphinxapi.SphinxClient()
    client.SetServer('localhost', 9312)
    searchResult = client.Query(lastPart)
    song_id = None
    
    if searchResult["total_found"] > 0:
        song_id = searchResult["matches"][0]["id"]
    return song_id


def get_cursor():
    con = db.connect('localhost', 'srubin_mbrowse', 'qual-cipe-whak', 'srubin_musicbrowser')
    cur = con.cursor()
    return con, cur

    
def get_dict_cursor():
    con = db.connect('localhost', 'srubin_mbrowse', 'qual-cipe-whak', 'srubin_musicbrowser')
    cur = con.cursor(db.cursors.DictCursor)
    return con, cur

def get_tag_categories(song_id):
    """song id --> tag categories, however that's defined"""

    con = db.connect('localhost', 'srubin_mbrowse', 'qual-cipe-whak',
                     'srubin_musicbrowser')
    cur = con.cursor(db.cursors.DictCursor)
    cur.execute("SELECT lastfm.weight, tags.tag FROM lastfm " +
                "JOIN tags ON lastfm.tag_id = tags.id WHERE song_id = %s",
                (song_id))
    lfmResult = cur.fetchall()
    matching_categories = []
    if len(lfmResult) > 0:
        min_weight = N.min([r["weight"] for r in lfmResult])
        matching_tags = []
        for row in lfmResult:
            if row["weight"] > min_weight:
                matching_tags.append(row["tag"])
        for category in tag_categories:
            for tag in matching_tags:
                if tag in category:
                    matching_categories.append(category)
                    break
    return matching_categories