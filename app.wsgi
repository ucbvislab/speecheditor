activate_this = '/var/www/html/srubin/speecheditor/speeched_env/bin/activate_this.py'
execfile(activate_this, dict(__file__=activate_this))

import sys
sys.path.insert(0, '/var/www/html/srubin/speecheditor')
sys.path.insert(0, '/var/www/html/srubin/speecheditor/speeched_env/lib/python2.7/site-packages')

from app import app as application