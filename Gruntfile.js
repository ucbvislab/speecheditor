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
                src: [
                    'static/script/setProductionEnv.js',
                    'static/script/underscore-min.js',
                    'static/script/soundmanager2-jsmin.js',
                    'static/script/textinputs.jquery.js',
                    'static/script/textareatest.js',
                    'static/script/bootstrap.min.js',
                    'static/script/bootstrap-fileupload.min.js',
                    'static/edible/js/jquery.ui.snap2.js',
                    'static/edible/js/edible.multicanvas.js',
                    'static/edible/js/edible.wfBase.js',
                    'static/edible/js/edible.waveform.js',
                    'static/edible/js/edible.textAlignedWaveform.js',
                    'static/edible/js/lib/jsnetworkx.js',
                    'static/edible/js/edible.musicWaveform.js',
                    'static/edible/js/edible.timeline.js',
                    'static/edible/js/lib/waveform.js',
                    'static/script/less.js'
                ],
                dest: 'static/script/textarea.min.js'
            },
            dev: {
                src: [
                    'static/script/underscore-min.js',
                    'static/script/spin.js',
                    'static/script/soundmanager2-jsmin.js',
                    'static/script/textinputs.jquery.js',
                    'static/script/jquery.tabSlideOut.js',
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
                ],
                dest: 'static/script/textarea-dev.min.js'
            }
        },
        concat: {
            dev: {
                src: [
                    'static/script/underscore-min.js',
                    'static/script/soundmanager2-jsmin.js',
                    'static/script/textinputs.jquery.js',
                    'static/script/textareatest.js',
                    'static/script/bootstrap.min.js',
                    'static/script/bootstrap-fileupload.min.js',
                    'static/edible/js/jquery.ui.snap2.js',
                    'static/edible/js/edible.multicanvas.js',
                    'static/edible/js/edible.wfBase.js',
                    'static/edible/js/edible.waveform.js',
                    'static/edible/js/edible.textAlignedWaveform.js',
                    'static/edible/js/lib/jsnetworkx.js',
                    'static/edible/js/edible.musicWaveform.js',
                    'static/edible/js/edible.timeline.js',
                    'static/edible/js/lib/waveform.js',
                    'static/script/less.js'
                ],
                dest: 'static/script/textarea-dev.min.js'
            }
        }
    });
    
    grunt.loadNpmTasks('grunt-contrib-coffee');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    
    grunt.registerTask('default', ['coffee:compile', 'uglify:dev']);
    // grunt.registerTask('dev', ['coffee:compile', 'uglify:dev']);
    // grunt.registerTask('devc', ['coffee:compile', 'concat:dev']);
};