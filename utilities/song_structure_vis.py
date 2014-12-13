import sys
import numpy as N
from matplotlib import pyplot as plt

name = "01_Dark_Fantasy"

def song_structure_vis(npz_filename):
    npz = N.load(npz_filename)
    markers = npz["markers"]
    sim_mat = npz["cost"]
    avg_duration = npz["avg_duration"][0]

    xpixels = N.shape(sim_mat)[0]
    ypixels = N.shape(sim_mat)[1]
    dpi = 72.0

    # sim_mat[N.where(sim_mat > 50)] = 50
    sim_mat = N.log(sim_mat)

    imgplt = plt.imshow(sim_mat, cmap=plt.cm.gray)
    imgplt.set_interpolation('nearest')
    # plt.show()

    print N.mean(sim_mat)
    print N.max(sim_mat)
    print N.min(sim_mat)

    plt.savefig("figures/%s_log_cost.png" % name)

if __name__ == '__main__':
    song_structure_vis("static/uploads/%s.npz" % name)