module.exports = function (grunt) {
    grunt.initConfig({
        min: {
            dist: {
                src: [
                    'static/script/underscore-min.js',
                    'static/script/underscore.observable.js',
                    'static/script/soundmanager2-jsmin.js',
                    'static/script/textinputs.jquery.js',
                    'static/script/timeline.jquery.js',
                    'static/script/textareatest.js',
                    'static/script/bootstrap.min.js',
                    'static/script/less.js'
                ],
                dest: 'static/script/textarea.min.js'
            }
        }
    });
    
    grunt.registerTask('default', 'min');
};