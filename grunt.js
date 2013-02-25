module.exports = function (grunt) {
    grunt.initConfig({
        min: {
            production: {
                src: [
                    'static/script/setProductionEnv.js',
                    'static/script/underscore-min.js',
                    'static/script/soundmanager2-jsmin.js',
                    'static/script/textinputs.jquery.js',
                    'static/script/textareatest.js',
                    'static/script/bootstrap.min.js',
                    'static/script/bootstrap-fileupload.min.js',
                    'edible/js/jquery.ui.snap2.js',
                    'edible/js/edible.wfBase.js',
                    'edible/js/edible.waveform.js',
                    'edible/js/textAlignedWaveform.js',
                    'edible/js/lib/jsnetworkx.js',
                    'edible/js/edible.musicWaveform.js',
                    'edible/js/edible.timeline.js',
                    'edible/js/lib/waveform.js',
                    'static/script/less.js'
                ],
                dest: 'static/script/textarea.min.js'
            },
            dev: {
                src: [
                    'static/script/underscore-min.js',
                    'static/script/soundmanager2-jsmin.js',
                    'static/script/textinputs.jquery.js',
                    'static/script/textareatest.js',
                    'static/script/bootstrap.min.js',
                    'static/script/bootstrap-fileupload.min.js',
                    'edible/js/jquery.ui.snap2.js',
                    'edible/js/edible.wfBase.js',
                    'edible/js/edible.waveform.js',
                    'edible/js/textAlignedWaveform.js',
                    'edible/js/lib/jsnetworkx.js',
                    'edible/js/edible.musicWaveform.js',
                    'edible/js/edible.timeline.js',
                    'edible/js/lib/waveform.js',
                    'static/script/less.js'
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
                    'edible/js/jquery.ui.snap2.js',
                    'edible/js/edible.wfBase.js',
                    'edible/js/edible.waveform.js',
                    'edible/js/textAlignedWaveform.js',
                    'edible/js/lib/jsnetworkx.js',
                    'edible/js/edible.musicWaveform.js',
                    'edible/js/edible.timeline.js',
                    'edible/js/lib/waveform.js',
                    'static/script/less.js'
                ],
                dest: 'static/script/textarea-dev.min.js'
            }
        }
    });
    
    grunt.registerTask('default', 'min:production');
    grunt.registerTask('dev', 'min:dev');
    grunt.registerTask('devc', 'concat:dev');
};