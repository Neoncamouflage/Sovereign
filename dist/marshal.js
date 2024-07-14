const Troupe = require('Troupe');
const DEFAULT_MISSION_PRIORITY = 5;
const MISSION_TYPES = [
    'demo',
    'cleanup',
]

const marshal = {
    //Assign missions to troupes and run them
    run: function(kingdomCreeps){
        for(let mission of Object.values(global.heap.missions)){
            if(!mission.assigned){
                let troupe = new Troupe(mission);
                mission.assigned = troupe.name;
            }
        }
        for(let troupe of global.heap.army.troupes){
            troupe.run(kingdomCreeps);
        }
    },
    //Mission types: Demo/Attack/Defend/Harass
    //Adds a mission, requirements depend on mission type
    //Preferable attributes are roomName, priority, type, targets
    addMission: function(options){
        let missionMap = global.heap.missionMap || setupMissionMap();
        let details = {};

        details.roomName = options.roomName; //Room is the target or requester room, depending on mission
        details.priority = options.priority || DEFAULT_MISSION_PRIORITY;
        if(options.type) details.type = options.type;
        if(options.targets) details.targets = options.targets;

        missionMap[details.roomName] = missionMap[details.roomName] || [];
        let newMission = new Mission(details);
        missionMap[details.roomName].push(newMission);
        global.heap.missions[newMission.missionID] = newMission

    }
}

function Mission(details) {
    this.missionID = generateMissionID();
    this.type = details.type;
    this.priority = details.priority
    this.room = details.roomName;
    this.tick = Game.time;
    this.targets = details.targets
    this.assigned = null;
}

Mission.prototype.complete = function(){
    global.heap.missionMap[this.room] = global.heap.missionMap[this.room].filter(miss => miss.missionID != this.missionID)
    delete global.heap.missions[this.missionID]
}

function setupMissionMap(){
    global.heap.missionMap = {};
    for(let mission of Object.values(global.heap.missions)){
        let missionRoom = global.heap.missionMap[mission.roomName] || [];
        missionRoom.push(mission);
    }

    return global.heap.missionMap;
}

function generateMissionID(){
    return Number(Math.floor(Math.random() * 0xffffffff))
    .toString(16)
    .padStart(8, '0');
}
global.addMission = marshal.addMission;
module.exports = marshal;