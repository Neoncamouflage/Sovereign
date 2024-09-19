const Troupe = require('Troupe');
const DEFAULT_MISSION_PRIORITY = 5;
const profiler = require('screeps-profiler');
const marshal = {
    //Assign missions to troupes and run them
    run: function(kingdomCreeps){
        //Before we do anything, clear any old alarms. 1500 ticks expiration
        for(let [room,alarm] of Object.entries(global.heap.alarms)){
            if(Game.time - alarm.tick > 1500 || (alarm.expiry && Game.time > alarm.expiry)) delete global.heap.alarms[room]
        }
        for(let mission of Object.values(global.heap.missions)){
            if(!mission.assigned){
                let troupe = new Troupe(mission);
                mission.assigned = troupe.name;
            }
        }
        for(let troupe of global.heap.army.troupes){
            troupe.run(kingdomCreeps);
        }
        //Order any reserves to wait in their fief
        for(let crp of global.heap.army.reserve){
            let creep = Game.getObjectById(crp)
            let injured = creep.room.find(FIND_MY_CREEPS).filter(crp => crp.hits < crp.hitsMax)
            let hostiles = creep.room.find(FIND_HOSTILE_CREEPS).filter(crp => !isFriend(crp.owner.username))
            let attk = creep.getActiveBodyparts(ATTACK);
            let rng = creep.getActiveBodyparts(RANGED_ATTACK);
            if(hostiles.length && (attk>1 || rng>1)){
                let target = creep.pos.findClosestByRange(hostiles);
                creep.travelTo(target,{range:rng > 1 ? 3 : 1});
                creep.attack(target);
                creep.rangedAttack(target);
            }
            else if(injured.length && creep.getActiveBodyparts(HEAL) > 1){
                creep.travelTo(injured[0])
                if(creep.pos.getRangeTo(injured[0]) > 1){
                    creep.rangedHeal(injured[0])
                }else{
                    creep.heal(injured[0])
                }
            }
            else{
                if(creep.room.name != creep.memory.fief){
                    creep.travelTo(Game.rooms[creep.memory.fief].controller,{range:10})
                }
                else if([0,1,48,49].includes(creep.pos.x) || [0,1,48,49].includes(creep.pos.y)){
                    creep.travelTo(Game.rooms[creep.memory.fief].controller);
                }
            }
        }
    },
    //Mission types: Demo/Attack/Defend/Harass
    //Adds a mission, requirements depend on mission type
    //Preferable attributes are roomName, priority, type, targets, scop
    addMission: function(options){
        let missionMap = global.heap.missionMap || setupMissionMap();
        let details = {};
        
        details.roomName = options.roomName; //Room is the target or requester room, depending on mission
        details.priority = options.priority || DEFAULT_MISSION_PRIORITY;
        if(options.type) details.type = options.type;
        if(options.targets) details.targets = options.targets || [];
        

        missionMap[details.roomName] = missionMap[details.roomName] || [];
        let newMission = new Mission(details);
        missionMap[details.roomName].push(newMission);
        global.heap.missions[newMission.missionID] = newMission

    },
    //Quick, premade missions to call
    defend(roomName){
        marshal.addMission({
            type:'defend',
            roomName:roomName,
        })
    },
    destroyCore(roomName){
        marshal.addMission({
            type:'destroyCore',
            roomName:roomName
        })
    },
    skMining(roomName){
        marshal.addMission({
            type:'skMining',
            roomName:roomName
        })
    }
}

function Mission(details) {
    this.missionID = generateMissionID();
    this.type = details.type;
    this.priority = details.priority
    this.room = details.roomName;
    this.tick = Game.time;
    this.targets = details.targets || [];
    this.done = false;
    this.assigned = null;
}

Mission.prototype.complete = function(){
    if(global.heap.missionMap[this.room].length == 1) delete global.heap.missionMap[this.room]
    else{global.heap.missionMap[this.room] = global.heap.missionMap[this.room].filter(miss => miss.missionID != this.missionID)}
    this.done = true;
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
profiler.registerObject(marshal, 'marshal');