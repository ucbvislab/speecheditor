activate_this = '/var/www/html/srubin/speecheditor/speeched_env/bin/activate_this.py'
execfile(activate_this, dict(__file__=activate_this))

from app import app as application