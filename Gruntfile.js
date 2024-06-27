module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');
    var target = grunt.option('private') ? 'private' : 'official';

    var serverConfig = {
        private: {
            email: 'neoncamouflage@gmail.com',
            password: 'Patriat0ma!',
            branch: 'default',
            server: {host: 'jayseegames.com',
                    port:21025,
                    http:true}
        },
        official: {
            email: 'neoncamouflage@gmail.com',
            token: 'aee622da-4d44-4d32-bb8d-57cc020be590',
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