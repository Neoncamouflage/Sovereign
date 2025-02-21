const profiler = require('screeps-profiler');
LOGS = {
    1:{},
    2:{},
    3:{}
}
LEVELS = {
    ERROR:1,
    WARN:2,
    INFO:3,
}
LEVEL_STRINGS = {
    1:"ERROR",
    2:"WARN",
    3:"INFO"
}
STREAMING = [];
TICKLOGS = [];
CACHE_PERIOD = 200;
const chronicle = {
    //Main operation command for each tick
    run(){
        if(Game.time % CACHE_PERIOD == 0){
            let errorCache = JSON.parse(RawMemory.segments[SEGMENT_LOGGING_ERR] || '{}');
            let warnCache = JSON.parse(RawMemory.segments[SEGMENT_LOGGING_WARN] || '{}');
            let infoCache = JSON.parse(RawMemory.segments[SEGMENT_LOGGING_INFO] || '{}');

            errorCache = {...errorCache,...LOGS[1]}
        }

        chronicle.display();
    },

    //Updates the log with a message and the source
    log(text,source,level,tags){
        //Convert level from string to int if needed. If still invalid, log and return
        if(LEVELS[level]) level = LEVELS[level]
        if(!LOGS[level]){
            console.log(`${source} logged with an incorrect level: ${level}`);
            return;
        }

        if(!LOGS[level][Game.time]) LOGS[level][Game.time] = [];
        let logEntry = {m:text,s:source,l:level};
        if(tags) logEntry.t = tags.split(',')
        LOGS[level][Game.time].push(logEntry)
        TICKLOGS.push(logEntry);
    },
    //Adds a source to the streaming array, outputting live to the console
    streamLogs(source){
        STREAMING.push(source)
    },
    //Removes a source from the streaming array
    stopLogs(source){
        if(!STREAMING.includes(source)){
            chronicle.log(`${source} is not currently streaming logs.`,'chronicle',1)
            return;
        }
    },
    //Writes the log to a segment
    write(){

    },
    //Gets logs by tick, source, or level
    get(){

    },
    //Displays logs in the console
    display(){
        let report = [];
        for(let log of TICKLOGS){
            //Stream all errors and lower levels for anything requested
            if(log.l == 1 || STREAMING.includes(log.s)){
                report.push(`[${LEVEL_STRINGS[log.l]}] (${log.s}) - ${log.m}`)
            }
        }
        if(report.length)console.log(report.join('\n'))
        TICKLOGS = [];
    }
}

module.exports = chronicle;
global.streamLogs = chronicle.streamLogs;
global.stopLogs = chronicle.stopLogs;
profiler.registerObject(chronicle, 'chronicle');