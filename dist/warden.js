const profiler = require('screeps-profiler');
const warden = {
    //Updates the log with a message and the source
    updateLog(error,source){
    },
    //Writes the log to a segment
    writeLog(){

    },
}

module.exports = warden;
profiler.registerObject(warden, 'warden');