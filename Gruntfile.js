module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');
    var target = grunt.option('config') || 'official'
    var config = require('./.screeps.json')

    var serverConfig = {
        local: {
            password: config.password,
            email:config.localEmail,
            server: {host: 'localhost',
                port:21025,
                http:true}
        },
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
            //server: 'shard3'
        },
        season:{
            email: config.email,
            token: config.token,
            branch: 'Sovereign',
            server: 'season'
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