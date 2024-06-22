const profiler = require('screeps-profiler');
const mapVisuals = {

    intel: function(){
        let scoutData = global.heap.scoutData;

        Object.entries(scoutData).forEach(([roomName,data])=>{
            //console.log(roomName)
            //console.log(JSON.stringify(data))
            Game.map.visual.text(roomName+"👁"+(Game.time-data.lastRecord), new RoomPosition(25,6,roomName), {color: 'white', fontSize: 6});
        });
    }
}

module.exports = mapVisuals;
profiler.registerObject(mapVisuals, 'mapVisuals');