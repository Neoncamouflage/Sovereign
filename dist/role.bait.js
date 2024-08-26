const helper = require('functions.helper');
var roleBait = {

    /** @param {Creep} creep **/
    run: function(creep) {
        //Assignments
       //
        if(creep.memory.job == 'scout'){
            let quotes = [
                "This land claimed in the name of the Sovereign. Invaders will be dispatched without quarter.",
                "Land of the Sovereign. Trespassers face the sword.",
                "Bound to the Throne. Tread lightly, or not at all.",
                "By royal seal, this land is spoken for.",
                "Here lies the reach of the Sovereign's arm. Let none dare to contest its claim.",
                "By the Crown, this land is claimed. Dare not oppose.",
                "This soil, kissed by Royal decree, curses all who trespass."
            ]
            if(!creep.memory.targetRooms) creep.memory.targetRooms = ['W56N11','W55N11','W55N12','W55N13','W56N13','W57N13','W57N12','W58N12','W58N13','W59N13','W59N12','W59N11','W58N11','W57N11'];
            let targetRooms = creep.memory.targetRooms;
            if(!creep.memory.index) creep.memory.index = 0;
            let targetRoom = targetRooms[creep.memory.index]
            if(!global.heap.scoutData[targetRoom]){
                creep.travelTo(new RoomPosition(25,25,targetRoom))
            }
            else{
                let roomData = global.heap.scoutData[targetRoom];
                if(roomData.controller){
                    creep.travelTo(new RoomPosition(roomData.controller.x,roomData.controller.y,targetRoom))
                }
                else{
                    creep.travelTo(new RoomPosition(25,25,targetRoom))
                }

                if(creep.pos.getRangeTo(new RoomPosition(roomData.controller.x,roomData.controller.y,targetRoom)) == 1){
                    let g = creep.signController(creep.room.controller,quotes[Math.floor(Math.random() * quotes.length)]);
                    if(g == OK){
                        if(creep.memory.index+1 < creep.memory.targetRooms.length){
                            creep.memory.index++;
                        }
                        else{
                            creep.suicide();
                        }
                    }
                }
            }
        }
        //addCreep('W56N12','Pilgrim',[MOVE,MOVE,MOVE],{role:'bait',targetRoom:'W49N12'})
        /*if(!creep.memory.targetRoom){
            creep.memory.targetRoom = 'W58N11'
        }
        if(!creep.memory.spawned && creep.ticksToLive < 650){
            //addCreep('W56N12','Pavise',[TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL],{role:'bait'})
            //addCreep('W56N12','Pavise',[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL],{role:'bait',boosted:true,boosted2:true})
            creep.memory.spawned = true;
        }
        creep.heal(creep);
        if(!creep.memory.boosted){
            let lab = Game.getObjectById('65eb8506938635e74981b8a4')
            if(!lab.mineralType){
                creep.memory.boosted = true;
            }
            else{
                let x = lab.boostCreep(creep);
                if(x == ERR_NOT_IN_RANGE){
                    creep.travelTo(lab)
                }else if(x == OK){
                    creep.memory.boosted = true;
                }
            }
            

        }
        else if(!creep.memory.boosted2){
                let lab = Game.getObjectById('6605cfe8670173b7ce3154ef')
                if(!lab.mineralType){
                    creep.memory.boosted2 = true;
                }
                else{
                    let x = lab.boostCreep(creep);
                    if(x == ERR_NOT_IN_RANGE){
                        creep.travelTo(lab)
                    }else if(x == OK){
                        creep.memory.boosted2 = true;
                    }
                
    
            }
        }
        else{
            creep.travelTo(new RoomPosition(28,48,creep.memory.targetRoom))
        }
        //creep.moveTo(new RoomPosition(24,5,creep.room.name),{range:5})
        */
       if(creep.memory.job == 'clapper'){ //[TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL]
            let lab;
            if(!creep.memory.boosted){
                lab = Game.getObjectById('6605cfe8670173b7ce3154ef')
                if(!lab.mineralType || lab.store[lab.mineralType] < 30){
                    creep.memory.boosted = true;
                }
                else{
                    let x = lab.boostCreep(creep);
                    if(x == ERR_NOT_IN_RANGE){
                        creep.travelTo(lab);
                        return;
                    }else if(x == OK){
                        creep.memory.boosted = true;
                    }
                }

            }
            if(!creep.memory.boosted2){
                lab = Game.getObjectById('65eb8506938635e74981b8a4')
                if(!lab.mineralType || lab.store[lab.mineralType] < 30){
                    creep.memory.boosted2 = true;
                }
                else{
                    let x = lab.boostCreep(creep);
                    if(x == ERR_NOT_IN_RANGE){
                        creep.travelTo(lab);
                        return;
                    }else if(x == OK){
                        creep.memory.boosted2 = true;
                    }
                }

            }
            if(!creep.memory.targetRoom){
                creep.memory.targetRoom = 'W57N17'
            }
            let targetPos = new RoomPosition(21,28,creep.memory.targetRoom);
            let target = Game.getObjectById('65b65c46212b71e713eb909b');
            if(creep.pos.getRangeTo(target) <= 3){
                creep.rangedAttack(target)
            }else{
                creep.travelTo(targetPos)
            }
            creep.heal(creep)
       }


       if(creep.memory.job == 'zapper'){
            if(!creep.memory.spawned && creep.ticksToLive < 700){
                addCreep('W56N12','Archer',[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK],{role:'bait',job:'zapper'})
                creep.memory.spawned = true;
            }
            if(!creep.memory.targetRoom){
                creep.memory.targetRoom = 'W59N12'
            }
            let targetPos = new RoomPosition(13,19,creep.memory.targetRoom);
            if(!creep.pos.isEqualTo(targetPos)){
                creep.travelTo(targetPos)
            }
            const targets = creep.pos.findInRange(FIND_HOSTILE_CREEPS,3);
            for(each of targets){
                if(each.pos.x != 14){
                    creep.rangedAttack(each);
                    break;
                }
            }
            if(!targets.length){
                creep.rangedAttack(Game.getObjectById('63fa24e6245b4f7e5b5dbb90'))
            }
       };
       if(creep.memory.job == 'sapper'){
            if(!creep.memory.targetRoom){
                creep.memory.targetRoom = 'E49N34'
            }
            if(!creep.memory.boosted && creep.room.name == 'E49N34'){
                lab = Game.getObjectById('636ae74447527103a415085a')
                /*if(!lab.mineralType || lab.store[lab.mineralType] < 30){
                    creep.memory.boosted = true;
                }
                else{
                    let x = lab.boostCreep(creep);
                    if(x == ERR_NOT_IN_RANGE){
                        creep.travelTo(lab);
                        return;
                    }else if(x == OK){
                        creep.memory.boosted = true;
                    }
                }*/
    
            }

            if(creep.room.name != creep.memory.targetRoom){
                creep.travelTo(new RoomPosition(9,41,creep.memory.targetRoom))
            }else{
                let targetStruct = Game.getObjectById('636ae74447527103a415085a')
                let nimbleFlag = false;
                if(!targetStruct){
                    targetStruct = creep.pos.findClosestByRange(structTargets);
                }
                if(!targetStruct){
                    structTargets = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => structure.structureType == STRUCTURE_SPAWN
                    });
                    targetStruct = creep.pos.findClosestByRange(structTargets);
                    nimbleFlag = true;
                }
                if(creep.pos.getRangeTo(targetStruct) == 1){
                    creep.dismantle(targetStruct);
                }
                else{
                    creep.travelTo(targetStruct,{ignoreCreeps:nimbleFlag});
                }
                //const targets = creep.pos.findInRange(FIND_HOSTILE_CREEPS,3);
                //for(each of targets){
                    //creep.rangedAttack(each);
                   // break;
               // }
            }
        }

    }
};

module.exports = roleBait;

