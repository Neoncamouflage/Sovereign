module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');
    var target = grunt.option('private') ? 'private' : 'official';
    var config = require('./.screeps.json')

    var serverConfig = {
        private: {
            email: config.email,
            password: config.password,
            branch: 'default',
            server: {host: 'jayseegames.com',
                    port:21025,
                    http:true}
        },
        official: {
            email: config.email,
            token: config.token,
            branch: 'Sovereign',
            server: 'shard3'
        }
    }

    grunt.initConfig({
        screeps: {
            options: serverConfig[target],
            dist: {
                src: ['dist/*.js']
            }
        }
    });
}