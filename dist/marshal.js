const Troupe = require('Troupe');
const DEFAULT_MISSION_PRIORITY = 5;
const profiler = require('screeps-profiler');
const helper = require('functions.helper');
const Quad = require('Quad');
const marshal = {
    //Assign missions to troupes and run them
    run: function(kingdomCreeps){
        //Before we do anything, clear any old alarms. 1500 ticks expiration
        for(let [room,alarm] of Object.entries(global.heap.alarms)){
            if(Game.time - alarm.tick > 1500 || (alarm.expiry && Game.time > alarm.expiry)) delete global.heap.alarms[room]
        }
        //Check tombstones
        checkTombstones();

        for(let mission of Object.values(heap.missions)){
            if(!mission.assigned){
                let troupe = new Troupe(mission);
                mission.assigned = troupe.name;
            }
        }
        for(let troupe of global.heap.army.troupes){
            troupe.run(kingdomCreeps);
        }
        //Run duos
        for(let att of Object.keys(heap.duos)){
            if(!Game.getObjectById(att))delete heap.duos[att]
        }

        //Run quads
        for(let quad of Object.values(heap.quads)){
            quad.run();
        }


        //Order any reserves to wait in their fief
        for(let crp of global.heap.army.reserve){
            
            let creep = Game.getObjectById(crp)
            
            let injured = creep.room.find(FIND_MY_CREEPS).filter(crp => crp.hits < crp.hitsMax)
            let hostiles = creep.room.find(FIND_HOSTILE_CREEPS).filter(crp => !isFriend(crp.owner.username) && !helper.isScout(crp))
            let attk = creep.getActiveBodyparts(ATTACK);
            let rng = creep.getActiveBodyparts(RANGED_ATTACK);
            let closeRange = false;
            let canHeal = creep.getActiveBodyparts(HEAL) > 1;
            if(hostiles.length && (attk>1 || rng>1)){
                creep.memory.stay = true
                let target = creep.pos.findClosestByRange(hostiles);
                creep.travelTo(target,{range:rng > 1 && !canHeal ? 3 : 1});
                creep.attack(target);
                if(creep.pos.getRangeTo(target) <=1){
                    creep.rangedMassAttack();
                    if(canHeal && injured.length){
                        if(creep.pos.getRangeTo(injured[0]) > 1){
                            creep.rangedHeal(injured[0])
                        }else{
                            creep.heal(injured[0])
                        }
                    };
                    closeRange = true;
                }
                else if(helper.isSoldier(target) && creep.pos.getRangeTo(target) <= 2){
                    let res = PathFinder.search(creep.pos, {pos:target.pos,range:4}, {flee:true})
                    let resPath = res.path;
                    let next = creep.pos.getDirectionTo(resPath[0])
                    let x = creep.move(next)
                    //let oppositeDirection = creep.pos.getDirectionTo(target);
                    //let moveDirection = (oppositeDirection + 3) % 8 + 1;
                    //creep.move(moveDirection);
                }
                else{
                    creep.rangedAttack(target);
                }

                
            }
            if(injured.length && creep.getActiveBodyparts(HEAL) > 1){
                if(!hostiles.length || closeRange)creep.travelTo(injured[0])
                if(creep.pos.getRangeTo(injured[0]) > 1){
                    creep.rangedHeal(injured[0])
                }else{
                    creep.heal(injured[0])
                }
            }
            else if(!hostiles.length){
                if(creep.memory.stay)creep.memory.stay = false
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
        let missionMap = heap.missionMap || setupMissionMap();
        let details = {};
        
        details.roomName = options.roomName || options.targetRoom; //Room is the target or requester room, depending on mission
        details.priority = options.priority || DEFAULT_MISSION_PRIORITY;
        if(options.type) details.type = options.type;
        if(options.targets) details.targets = options.targets || [];
        if(options.baseFief) details.baseFief = options.baseFief;
        if(options.unitsNeeded) details.unitsNeeded = options.unitsNeeded
        

        missionMap[details.roomName] = missionMap[details.roomName] || [];
        let newMission = new Mission(details);
        missionMap[details.roomName].push(newMission);
        heap.missions[newMission.missionID] = newMission


        if(!newMission.assigned){
            let troupe = new Troupe(newMission);
            newMission.assigned = troupe.name;
        }

        chronicle.log(`Troupe ${newMission.assigned} assigned ${options.type} mission for ${options.roomName}.`,'marshal',3);

    },
    //Quick, premade missions to call
    defend(roomName){
        marshal.addMission({
            type:'defend',
            roomName:roomName,
        })
    },
    destroyCore(roomName,core,resTime){
        marshal.addMission({
            type:'destroyCore',
            roomName:roomName,
            targets: [core] || [],
            resTime:'resTime'
        })
    },
    skMine(roomName){
        marshal.addMission({
            type:'skMining',
            roomName:roomName
        })
    },
    settle(roomName){
        marshal.addMission({
            type:'settle',
            roomName:roomName
        })
    },
    harass(roomName){
        marshal.addMission({
            type:'rangedHarass',
            roomName:roomName
        })
    }
}

// ---TODO---
//Add more prototype methods so I can modify these on the fly
//Add/remove creeps, change properties quickly, etc
function Mission(details) {
    this.missionID = generateMissionID();
    this.type = details.type;
    this.priority = details.priority
    this.room = details.roomName;
    this.tick = Game.time;
    this.targets = details.targets || [];
    this.done = false;
    this.baseFief = details.baseFief || null;
    this.unitPick = details.unitsNeeded;
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

function checkTombstones(){
    for(const roomName of Object.keys(heap.tombstones)){
        let tombstones = heap.tombstones[roomName];
        for(const tomb of tombstones){
            //Recent death not due to TTL
            if(tomb.deathTime == Game.time-1 && tomb.creep.ticksToLive > 1){
                console.log("Tombstone found:",JSON.stringify(tomb.creep))
                let events = tomb.room.getEventLog();
                
            }
        }
    }
}
global.addMission = marshal.addMission;
global.destroyCore = marshal.destroyCore;
global.defend = marshal.defend;
global.settle = marshal.settle;
global.skMine = marshal.skMine;
global.harass = marshal.harass;


module.exports = marshal;
profiler.registerObject(marshal, 'marshal');
profiler.registerClass(Mission, 'Mission');