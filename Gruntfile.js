module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        coffee: {
            compile: {
                files: {
                    'static/script/textAreaManager.js': 'static/script/textAreaManager.coffee'
                }
            }
        },
        uglify: {
            production: {
                'static/script/textarea.min.js':
                    ['static/script/setProductionEnv.js', 'static/script/textarea-dev.js']
            },
            dev: {
                'static/script/textarea-dev.min.js': 'static/script/textarea-dev.js'
            }
        },
        concat: {
            dev: {
                src: [
                    'static/script/underscore-min.js',
                    'static/script/spin.js',
                    'static/script/soundmanager2-jsmin.js',
                    'static/script/textinputs.jquery.js',
                    'static/script/jquery.tabSlideOut.js',
                    'static/script/jquery.scrollTo/jquery.scrollTo.min.js',
                    "static/script/lib/jquery.zclip.js",
                    'static/script/bootstrap-custom.min.js',
                    'static/script/bootstrap-fileupload.min.js',
                    'static/edible/js/jquery.ui.snap2.js',
                    'static/edible/js/edible.multicanvas.js',
                    'static/edible/js/edible.wfBase.js',
                    'static/edible/js/edible.waveform.js',
                    'static/edible/js/edible.textAlignedWaveform.js',
                    'static/edible/js/lib/jsnetworkx.js',
                    "static/edible/js/lib/cubicspline.js",
                    'static/edible/js/edible.musicWaveform.js',
                    'static/edible/js/edible.timeline.js',
                    'static/edible/js/lib/waveform.js',
                    'static/script/less.js',
                    'static/script/textAreaManager.js',
                    'static/script/textareatest.js',
                    'static/musicbrowser/js/jquery.dataTables.min.js',
                    "static/musicbrowser/js/paging.js",
                    "static/musicbrowser/js/berniecode-animator.js",
                    "static/musicbrowser/js/kdTree.js",
                    "static/musicbrowser/js/musicBrowserApp.js"
                ],
                dest: 'static/script/textarea-dev.js'

            }
        }
    });
    
    grunt.loadNpmTasks('grunt-contrib-coffee');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    
    grunt.registerTask('dev', ['coffee:compile', 'concat:dev']);
    grunt.registerTask('default', ['dev', 'uglify:dev']);
    grunt.registerTask('production', ['dev', 'uglify:production']);
    
};