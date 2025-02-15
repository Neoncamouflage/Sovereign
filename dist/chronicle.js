const profiler = require('screeps-profiler');
LOG_ERR  = {};
LOG_WARN = {};
LOG_INFO = {};
const chronicle = {
    //Updates the log with a message and the source
    log: function(error,source){
    },
    //Writes the log to a segment
    write: function(){

    },
}

module.exports = chronicle;
profiler.registerObject(chronicle, 'chronicle');