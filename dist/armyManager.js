const DEFAULT_MISSION_PRIORITY = 5;
const MISSION_TYPES = [
    'demo',
    'cleanup',
]

const armyManager = {
    //Runs mission checks
    run: function(){
        for(let mission of Memory.kingdom.missions){
            if(mission.type == 'demo') this.runDemo(mission)
        }
    },
    //Mission types: Demo/Attack/Defend/Harass
    //Adds a mission, requirements depend on mission type
    addMission: function(options){
        let details = {};
        details.priority = options.priority || DEFAULT_MISSION_PRIORITY;
        if(options.type) details.type = options.type;
        if(options.targets) details.targets = options.targets;
        let mission = new Mission(details);
        Memory.kingdom.missions.push(mission);
    }
}

function calculateDemo(roomName,targets=[]){

}

function Mission(details) {
    this.missionID = generateMissionID();
    this.type = details.type;
    this.priority = details.priority
    this.troupes = [];
    this.tick = Game.time;
}

Mission.prototype.assignTroupe = function(troupe) {

};

function generateMissionID(){
    return Number(Math.floor(Math.random() * 0xffffffff))
    .toString(16)
    .padStart(8, '0');
}

module.exports = armyManager;