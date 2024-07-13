var roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.job == 'reserver'){
            if(!creep.memory.preflight){
                creep.memory.preflight = true;
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
                let g = creep.signController(creep.room.controller, targetText);
                if(g == ERR_NOT_IN_RANGE) {
                    creep.travelTo(creep.room.controller);
                }
                if(creep.claimController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(creep.room.controller);
                }
                else if(g == 0){
                    creep.suicide();
                }
            }   
        }
        
    }
};

module.exports = roleClaimer;

