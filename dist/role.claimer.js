const helper = require('functions.helper');

const roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.job == 'reserver'){
            if(!creep.memory.preflight){
                creep.memory.preflight = true;
            }
            if(global.heap.alarms[creep.memory.holding]){     
                if(creep.room.name != creep.memory.fief){
                    creep.memory.stay = false;
                    creep.memory.status = 'flee';
                    creep.travelTo(Game.rooms[creep.memory.fief].controller)
                    let words = helper.getSay({symbol:`${Game.time % 2 == 0 ? '🚨' : '📢'}`});
                    creep.say(words.join(''))
                }
                else{
                    console.log("AYE")
                    if([0,1,48,49].includes(creep.pos.x) || [0,1,48,49].includes(creep.pos.y)){
                        console.log("TWO")
                        creep.travelTo(Game.rooms[creep.memory.fief].controller);
                    }
                }
                return;
            }
            var targetRoom = creep.memory.holding;
            var targetText = 'Tax Collection Ongoing💰'
            if(creep.room.name != targetRoom){
                    creep.travelTo(new RoomPosition(creep.memory.target.x,creep.memory.target.y,creep.memory.holding));
            }
            else {
                if(creep.room.controller.reservation && creep.room.controller.reservation.username != Memory.me){
                    if(creep.attackController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.controller)
                    }
                }
                else{
                    //console.log("RESERVING ",JSON.stringify(creep.room.controller))
                    let attempt = creep.reserveController(creep.room.controller)
                    if(attempt == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.controller)
                    }else if(attempt == OK){
                        if(!creep.memory.signed){
                            creep.signController(creep.room.controller,targetText)
                            creep.memory.signed = true;
                        }
                        //console.log(attempt)
                    }
                    
                }
                
            }  
        }
        else if(creep.memory.job == 'tagger'){
            var targetRoom = creep.memory.targetRoom;
            var targetText = 'Keep off me lawn 🤺'
            
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(8, 46, targetRoom));
            }
            else {
                
                        if(creep.signController(creep.room.controller, targetText) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.controller);
                        }
                    

            }
        }
        else if(creep.memory.job == 'attacker'){
            if(!creep.memory.preflight){
                Memory.flag1 = Game.time;
                creep.memory.preflight = true;
            }
            targetRoom = creep.memory.targetRoom
            if(true){
                if(creep.room.name != targetRoom){
                    creep.travelTo(new RoomPosition(16,30,targetRoom));
                }
                else {
                    creep.travelTo(creep.room.controller)
                    //creep.attackController(creep.room.controller)
                }   
            }
        }
        else if(creep.memory.job == 'claimer'){
            var targetRoom = creep.memory.targetRoom;
            var targetText = '🏰'
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(38, 23, targetRoom));
            }
            else {
            
                if(creep.pos.getRangeTo(creep.room.controller) > 1){
                    creep.travelTo(creep.room.controller)
                    return;
                }
                let g = creep.signController(creep.room.controller, targetText);
                if(creep.room.controller.reservation && creep.room.controller.reservation.username.toLowerCase() != Memory.me.toLowerCase()){
                    creep.attackController(creep.room.controller)
                }
                else{
                    creep.claimController(creep.room.controller)
                }
            }   
        }
        
    }
};

module.exports = roleClaimer;

