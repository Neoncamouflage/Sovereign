module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');

    grunt.initConfig({
        screeps: {
            options: {
                email: 'neoncamouflage@gmail.com',
                token: 'aee622da-4d44-4d32-bb8d-57cc020be590',
                branch: 'Sovereign',
                server: 'shard3'
            },
            dist: {
                src: ['dist/*.js']
            }
        }
    });
}