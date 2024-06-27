var roleStarters = {
    //Starters is an array of every starter creep game objects in a fief
    run: function(starters,room) {
        let fief = Memory.kingdom.fiefs[room.name];
        let spawn = Game.getObjectById(fief.spawns[0]);
        var fills = room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        let cSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        let roomCreeps = room.find(FIND_MY_CREEPS);
        let babyHauls = starters.filter(creep => creep.memory.job === 'babyHaul');
        let babyBuilders = starters.filter(creep => creep.memory.job === 'babyBuilder');
        let babyUps = starters.filter(creep => creep.memory.job === 'babyUpgrader');
        let babyHarvs = starters.filter(creep => creep.memory.job === 'babyHarvest');
        let babyRelays = starters.filter(creep => creep.memory.job === 'babyRelay');
        let baddies = room.find(FIND_HOSTILE_CREEPS);
        //Check for FF can
        let ffCan = null;
        let tower = room.find(FIND_MY_STRUCTURES,{
            filter: (structure) => {return structure.structureType == STRUCTURE_TOWER}
        })[0]
        if(fief.fastFiller && Object.keys(fief.fastFiller).length){
            //If ff spawn exists, get the can ID
            ffCan = Game.getObjectById(fief.fastFiller[Object.keys(fief.fastFiller)[0]]['can']);
        }
        //Baby relays grab energy and then look for an upgrader to give it to
        babyRelays.forEach(creep => {
            //console.log("RELAY")
            let ups = roomCreeps.filter(creep => creep.memory.job == 'babyUpgrader'&& creep.store.getUsedCapacity() < 5);

            //If can and no construction
            if(ffCan && ffCan.store[RESOURCE_ENERGY] > 0 && !cSites.length){
                //If empty
                if(creep.store[RESOURCE_ENERGY] < 50){
                    if(creep.withdraw(ffCan,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                        creep.travelTo(ffCan);
                    }
                }
                //If not
                else if(ups.length){
                    let closestUp = creep.pos.findClosestByRange(ups)
                    if(creep.transfer(closestUp,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                        creep.travelTo(closestUp);
                    }
                }
                
            }
        });




        //Baby builders will build FF can first, then extensions
        babyBuilders.forEach(creep =>{
            //First priority is container, for the FFcan
            let target = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: { structureType: STRUCTURE_CONTAINER}
            })[0];
            //Second priority is the tower at RCL 3
            if(!target){
                target = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
                    filter: { structureType: STRUCTURE_TOWER}
                })[0];
            }
            //Third priority is storage at RCL 4
            if(!target || room.controller.level == 4){
                target = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
                    filter: { structureType: STRUCTURE_STORAGE}
                })[0];
            }
            if(!target){
                target = creep.room.find(FIND_MY_CONSTRUCTION_SITES)[0];
            }
            //console.log(target)
            //If empty, refill
            if(!target){
                fief.upgraders.push(creep.name);
                creep.memory.job = 'babyUpgrader'

            }
            if(creep.store[RESOURCE_ENERGY] == 0){
                //Check for storage forst
                let ruins = room.find(FIND_RUINS)
                let ruinTargets = ruins.filter(spot => spot.store[RESOURCE_ENERGY] > 500);
                if(room.storage && room.storage.store[RESOURCE_ENERGY] > 2000){
                    if(creep.pos.getRangeTo(room.storage) > 1){
                        creep.travelTo(room.storage,{range:1})
                    }else{
                        creep.withdraw(room.storage,RESOURCE_ENERGY);
                    }
                }
                //Refill from ff can if there, spawn if not
                else if(ffCan){
                    if(ffCan.store[RESOURCE_ENERGY] > 0){
                        if(creep.withdraw(ffCan,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                            creep.travelTo(ffCan);
                        }
                    }
                    else if(ruinTargets.length){
                        if(creep.withdraw(creep.pos.findClosestByRange(ruinTargets),RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                            creep.travelTo(creep.pos.findClosestByRange(ruinTargets));
                        }
                    }
                    else{
                        if(creep.pos.getRangeTo(spawn) < 6){
                            creep.travelTo(creep.room.controller,{range:3})
                        }
                    }
                    
                }else if(spawn.store[RESOURCE_ENERGY] > 50){
                    if(creep.withdraw(spawn,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                        creep.travelTo(spawn);
                    }
                }else{
                    if(creep.pos.getRangeTo(spawn) < 4){
                        let mo = creep.pos.getDirectionTo(spawn);
                        let avoid;
                        console.log(mo)
                        
                        switch(mo){
                            case TOP:
                                avoid = BOTTOM;
                                break;
                            case TOP_RIGHT:
                                avoid = BOTTOM_LEFT;
                                break;
                            case TOP_LEFT:
                                avoid = BOTTOM_RIGHT;
                                break;
                            case BOTTOM:
                                avoid = TOP;
                                break;
                            case BOTTOM_RIGHT:
                                avoid = TOP_LEFT;
                                break;
                            case BOTTOM_LEFT:
                                avoid = TOP_RIGHT;
                                break;
                            case LEFT:
                                avoid = RIGHT;
                                break;
                            case RIGHT:
                                avoid = LEFT;
                                break;

                        }
                    }
                }

            }
            //Otherwise build
            else{
                creep.travelTo(target,{range:2});
                creep.build(target)
            }
        });



        

        //Baby upgraders will fill from spawn and then upgrade
        babyUps.forEach(creep =>{
            if(!creep.memory.state){
                creep.memory.state = 'pickup';
            }
            let state = creep.memory.state;
            if(state == 'pickup' && creep.store[RESOURCE_ENERGY] > 0){
                creep.memory.state = 'upgrade';
                state = 'upgrade';
            }else if(state == 'upgrade' && creep.store[RESOURCE_ENERGY] == 0){
                state = 'pickup';
                creep.memory.state = 'pickup';
            }

            if((creep.ticksToLive < 60) && ffCan){
                if(creep.pos.y != ffCan.pos.y || creep.pos.x != ffCan.pos.x){
                    creep.travelTo(ffCan);
                }else{
                    creep.suicide();
                }
            }
            else if(cSites.length && state == 'pickup'){
                fief.builders.push(creep.name);
                creep.memory.job = 'babyBuilder'
            }
            else if(state == 'pickup'){
                let ruins = room.find(FIND_RUINS)
                let ruinTargets = ruins.filter(spot => spot.store[RESOURCE_ENERGY] > 500);
                if(ffCan){
                    if(ffCan.store[RESOURCE_ENERGY] > 0 && !cSites.length){
                        if(creep.withdraw(ffCan,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                            creep.travelTo(ffCan);
                        }
                    }
                    else if(ruinTargets.length){
                        if(creep.withdraw(creep.pos.findClosestByRange(ruinTargets),RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                            creep.travelTo(creep.pos.findClosestByRange(ruinTargets));
                        }
                    }
                    //Move creep away if it's next to spawn
                    else{
                        if(creep.pos.getRangeTo(spawn) < 6){
                            creep.travelTo(creep.room.controller,{range:3})
                        }
                    }
                }
                else if(creep.withdraw(spawn,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                    creep.travelTo(spawn);
                }
            }
            else if(state == 'upgrade'){
                creep.travelTo(creep.room.controller,{range:1});
                creep.upgradeController(creep.room.controller);
            }



        });

        //Baby Harvesters will go to their assigned source and harvest
        babyHarvs.forEach(creep =>{
            let target = Game.getObjectById(creep.memory.target);
            //If room is ready to produce serfs, suicide
            if(creep.room.energyCapacityAvailable == 550){
                creep.suicide();
            }
            else if(creep.harvest(target) == ERR_NOT_IN_RANGE){
                creep.travelTo(target);
            }
            if(!creep.memory.stay && creep.pos.getRangeTo(target) == 1){
                creep.memory.stay = true;
            }
        });




        //Baby haulers will be assigned a source and find energy near that
        //Set up an object to hold all drops by their source ID
        let targetDrops = {};
        Object.keys(fief.sources).forEach(key=>{
            //Get only the sources
            if(key != 'closest'){
                let source = Game.getObjectById(key);
                targetDrops[key] = source.pos.findInRange(FIND_DROPPED_RESOURCES,1);
            }
        })


        babyHauls.forEach(creep =>{
            if(!creep.memory.state){
                creep.memory.state = 'pickup';
            }
            let state = creep.memory.state;
            if(state == 'pickup' && creep.store.getFreeCapacity() == 0){
                creep.memory.state = 'dropoff';
                state = 'dropoff';
            }else if(state == 'dropoff' && creep.store[RESOURCE_ENERGY] == 0){
                state = 'pickup';
                creep.memory.state = 'pickup';
            }

            let target;

            //This all needs fixed. Haulers just wait by spawn if nothing to pick up
            //If creep needs to pick up
            if(state == 'pickup'){
                //If there's drops 
                //console.log(targetDrops[creep.memory.target])
                if(targetDrops[creep.memory.target].length){
                    //Just get the first one in the array
                    target = targetDrops[creep.memory.target][0];
                    if(creep.pickup(target) == ERR_NOT_IN_RANGE){
                        let x =creep.travelTo(target);
                        //console.log(x)
                    }
                }
                //If not, just go to near the source
                else{
                    //console.log("No target")
                    target = Game.getObjectById(creep.memory.target);
                    //console.log(JSON.stringify(target))
                    creep.travelTo(target,{range:3});
                }

            }
            //If dropping off
            else if(state == 'dropoff'){
                //If there are fillables
                
                //If FF can is built and has room, and there's enough energy for a QM
                if((tower && tower.store[RESOURCE_ENERGY] <700) || baddies.length){
                    if(creep.transfer(tower,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                        creep.travelTo(tower);
                    }
                }
                else if(creep.room.storage){
                    if(creep.transfer(creep.room.storage,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                        creep.travelTo(creep.room.storage);
                    }
                }
                else if(creep.room.energyCapacityAvailable >= 550 && ffCan && ffCan.store.getFreeCapacity() != 0){
                    if(creep.transfer(ffCan,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                        creep.travelTo(ffCan);
                    }
                }
                //Else if we have empty structures
                else if(fills.length){
                    target = creep.pos.findClosestByRange(fills);
                    if(creep.transfer(target,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                        creep.travelTo(target);
                    }
                }
                //Else if we have a tower
                else if(tower && tower.store[RESOURCE_ENERGY] <1000){
                    if(creep.transfer(tower,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                        creep.travelTo(tower);
                    }
                }
                else if(ffCan && ffCan.store.getFreeCapacity() > 0){
                    if(creep.transfer(ffCan,RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                        creep.travelTo(ffCan);
                    }
                }
                //If not, go to near spawn
                else{
                    
                    if(ffCan && creep.pos.getRangeTo(ffCan) <3){
                        let mo = creep.pos.getDirectionTo(spawn);
                        let avoid;
                        //console.log(mo)
                        
                        switch(mo){
                            case TOP:
                                avoid = BOTTOM;
                                break;
                            case TOP_RIGHT:
                                avoid = BOTTOM_LEFT;
                                break;
                            case TOP_LEFT:
                                avoid = BOTTOM_RIGHT;
                                break;
                            case BOTTOM:
                                avoid = TOP;
                                break;
                            case BOTTOM_RIGHT:
                                avoid = TOP_LEFT;
                                break;
                            case BOTTOM_LEFT:
                                avoid = TOP_RIGHT;
                                break;
                            case LEFT:
                                avoid = RIGHT;
                                break;
                            case RIGHT:
                                avoid = LEFT;
                                break;

                        }
                        creep.move(avoid)
                    }else if(ffCan && creep.pos.getRangeTo(ffCan) >3){
                        creep.travelTo(ffCan,{range:3})
                    }
                }
            }

        });
        



    }
};

module.exports = roleStarters;

