const profiler = require('screeps-profiler');
LOGS = {
    1:{},
    2:{},
    3:{},
    4:{}
}
LEVELS = {
    ERROR:1,
    WARN:2,
    INFO:3,
    DEBUG:4
}
LEVEL_STRINGS = {
    1:"ERROR",
    2:"WARN",
    3:"INFO",
    4:"DEBUG"
}
STREAMING = [];
TICKLOGS = [];
CACHE_PERIOD = 1700;
const chronicle = {
    showDebug:true,
    showInfo:true,
    showWarning:true,
    showError:true,
    //Main operation command for each tick
    run(){
        if(Game.time % CACHE_PERIOD == 0){
            let errorCache = JSON.parse(RawMemory.segments[SEGMENT_LOGGING_ERR] || '{}');
            let warnCache = JSON.parse(RawMemory.segments[SEGMENT_LOGGING_WARN] || '{}');
            let infoCache = JSON.parse(RawMemory.segments[SEGMENT_LOGGING_INFO] || '{}');

            errorCache = {...errorCache,...LOGS[1]};
            warnCache = {...warnCache,...LOGS[2]};
            infoCache = {...infoCache,...LOGS[3]};
            while(JSON.stringify(errorCache).length > 80000){
                delete errorCache[Object.keys(errorCache)[0]]
            }
                
            while(JSON.stringify(warnCache).length > 80000){
                delete warnCache[Object.keys(warnCache)[0]]
            }
            while(JSON.stringify(infoCache).length > 80000){
                delete infoCache[Object.keys(infoCache)[0]]
            }
            RawMemory.segments[SEGMENT_LOGGING_ERR] = JSON.stringify(errorCache);
            RawMemory.segments[SEGMENT_LOGGING_WARN] = JSON.stringify(warnCache);
            RawMemory.segments[SEGMENT_LOGGING_INFO] = JSON.stringify(infoCache);
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
        return `${source} added to streaming logs. Currently streaming: ${STREAMING.join(', ')}`
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
    //{level:'info'}        Will limit log retrieval to a specific level
    //{source:'marshal'}    Will limit log retrieval to a specific source
    //{tick:32599}          Specifies the tick to retrieve logs from
    //{all:true}            If given with tick parameter, pulls all logs after and including that tick
    getLogs({level=false,source=false,tick=false,single=false}={}){
        if(level) level = [level]

    },
    //Displays logs in the console
    display(){
        let displayLevels = [];
        if(this.showDebug) displayLevels.push(4)
        if(this.showError) displayLevels.push(1)
        if(this.showWarning) displayLevels.push(2)
        if(this.showInfo) displayLevels.push(3)
        let report = [];
        for(let log of TICKLOGS){
            //Stream all errors, debugs, and lower levels for anything requested
            if(displayLevels.includes(log.l) || STREAMING.includes(log.s)){
                report.push(`[${LEVEL_STRINGS[log.l]}] (${log.s}) - ${log.m}`)
            }
        }
        if(report.length)console.log(report.join('\n'))
        TICKLOGS = [];
    }
}

module.exports = chronicle;
global.chronicle = chronicle;
profiler.registerObject(chronicle, 'chronicle');