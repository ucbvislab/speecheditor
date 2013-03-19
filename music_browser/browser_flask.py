# Server to serve constraint requests for the 
# music browser application

try:
    import simplejson as json
except ImportError:
    import json

import flask
from flask import Flask, request, make_response, jsonify, Response


import numpy as N
from scipy.spatial import KDTree

import songs_db

try:
    from app_path import APP_PATH
except:
    APP_PATH = ''

con, db = songs_db.get_cursor()
# db = web.database(dbn='mysql', user='srubin_music', pw='qual-cipe-whak', db='srubin_music')

app = Flask(__name__)

class MFCCNeighbors:
    def __init__(self):
        db.execute("SELECT * FROM mfccs_long")
        rows = db.fetchall()

        USE_C0 = False
        if USE_C0:
            ceps = 13
            first_cep = 0
        else:
            ceps = 12
            first_cep = 1

        self.idToMFCC = {}
        self.idxToId = [row[1] for row in rows]
        X = N.zeros((len(rows), ceps))
        for i, row in enumerate(rows):
            self.idToMFCC[row[1]] = row[first_cep + 2:]
            X[i,:] = row[first_cep + 2:]

        self.neigh = KDTree(X, leafsize=3)

        # self.neigh = NearestNeighbors(n_neighbors=15)
        # self.neigh.fit(X)


    def nearest(self, song_id):
        # nn = self.neigh.kneighbors(self.idToMFCC[int(song_id)])
        nn = self.neigh.query(N.array(self.idToMFCC[int(song_id)]), k=15)
        
        dists = nn[0]
        ids = nn[1]
        out = []
        for i, d in enumerate(dists):
            out.append((d, self.idxToId[ids[i]]))
        return out

nn = MFCCNeighbors()
    
@app.route('/')
def index(self):
    pass
    # raise web.seeother('browser_app.html')


@app.route('/nearest/<int:song_id>')      
def nearest(song_id):
    nbs = nn.nearest(song_id)
    return nbs


@app.route('/constrained')
def constrained():
    constraints = json.loads(request.args.get('c'))
    song_id = request.args.get('song_id')

    # apache.log_error("## CONSTRAINTS " + str(constraints), apache.APLOG_ERR)
        
    # get song data
    query =\
    """
    SELECT * FROM songs
    JOIN echonest ON echonest.song_id = songs.id 
    JOIN mlr_va ON mlr_va.song_id = songs.id
    WHERE songs.id = %s;
    """
        
    print query, song_id
    
    db.execute(query, song_id)
    song = db.fetchone()
    desc = db.description

    song_data = {}

    for i, item in enumerate(desc):
        song_data[item[0]] = {
            "type": songs_db.field_type[item[1]],
            "value": song[i]
        }

    do_not_use = ['song_id', 'song_key', 'title', 'en_id', 'start_time',
                  'end_time', 'id', 'source_id', 'energy']
        
    queries = []
    order = ""
        
    # if len(constraints) == 0:
    #     web.header('Content-Type', 'application/json')
    #     return json.dumps([row[0] for row in rows])
        
    nn_distances = {}
        
    maxes = {}
    mins = {}
    pivot_vals = {}
        
    for constraint in constraints:
        if constraint == 'mfccs':
            nbs = nn.nearest(song_id)
            id_list = ','.join([str(n[1]) for n in nbs])
            for n in nbs:
                nn_distances[n[1]] = n[0]
            q = "songs.id IN (%s)" % id_list
            order = " ORDER BY FIELD(songs.id, %s)" % id_list
            queries.append(q)
        else:
            feature = song_data[constraint]
            if feature["type"] == 'BLOB':
                q = "%s = '%s'" % (constraint, feature["value"])
                queries.append(q)
            elif feature["type"] == 'FLOAT':
                get_max_min = \
                """
                SELECT max(%s), min(%s) FROM songs
                JOIN echonest ON echonest.song_id = songs.id 
                JOIN mlr_va ON mlr_va.song_id = songs.id;
                """ % (constraint, constraint)
                db.execute(get_max_min)
                (max_val, min_val) = db.fetchone()
                maxes[constraint] = max_val
                mins[constraint] = min_val
                span = float(max_val) - float(min_val)
                pivot_vals[constraint] = feature["value"]
                range_low = feature["value"] - .05 * span
                range_high = feature["value"] + .05 * span
                q = "%s > %s AND %s < %s" %\
                    (constraint, range_low, constraint, range_high)
                queries.append(q)
    master =\
    """
    SELECT * FROM songs
    JOIN echonest ON echonest.song_id = songs.id 
    JOIN mlr_va ON mlr_va.song_id = songs.id 
    WHERE 
    """
    master += " AND ".join(queries)
    master += order
    print
    print master
    print
    # apache.log_error("## QUERY " + master, apache.APLOG_ERR)
        
    db.execute(master)
    rows = db.fetchall()
        
    cols_for_distance = []
    for i, col in enumerate(db.description):
        if col[0] in constraints:
            if songs_db.field_type[col[1]] == 'FLOAT':
                cols_for_distance.append((i, col[0]))
        
    other_distances = []
    for row in rows:        
        tmp_dist = []
        for cfd in cols_for_distance:
            feature = cfd[1]
            tmp_dist.append(
                 abs(pivot_vals[feature] -
                    row[cfd[0]]) /
                 (maxes[feature] - mins[feature]))
        if len(tmp_dist) > 0:
            other_distances.append(N.mean(tmp_dist))
                
    out_sorter = []
    if len(nn_distances.keys()) > 0:
        out_sorter = [round(nn_distances[row[0]], 2) for row in rows]
    elif len(other_distances) > 0:
        out_sorter = [round(x, 3) for x in other_distances]

    print "## OUT SORTER", out_sorter
        
    return jsonify(**{
        "songs": [row[0] for row in rows],
        "query": master, 
        "sorter": out_sorter
    })

if __name__ == "__main__":
    pass