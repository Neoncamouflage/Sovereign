const helper = require('functions.helper');
const SIGNS = [
            "This soil has drunk the blood of those who dared question the Crown. It is richer for it.",
            "This holding has been deemed worthy of the Sovereign's attention, if not the Sovereign's residence.",
            "The Sovereign's Porters walk these roads with purpose. The land is honored by their boots.",
            "This bounty is yielded in service to the Throne.",
            "These resources are bound to the Sovereign's will",
            "This holding feeds the kingdom's ambition. It is a noble purpose.",
            "This land was not conquered. It was chosen. There is a greatness in that.",
            "These resources flow toward the Throne like rivers to the sea. Inevitably, and without question.",
            "The Crown needs no deed to this land. Its purpose has been written into the soil itself.",
            "To serve the Throne's ambition, even unknowingly, is a land's highest calling."
        ]
const roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.job == 'reserver'){
            if(!creep.memory.preflight){
                creep.memory.preflight = true;
            }
            if(false && global.heap.alarms[creep.memory.holding]){     
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
            let targetRoom = creep.memory.holding;
            let holding = Memory.kingdom.holdings[targetRoom];
            //var targetText = 'Tax Collection Ongoing💰'
            if(creep.room.name != targetRoom){
                    creep.travelTo(new RoomPosition(creep.memory.target.x,creep.memory.target.y,creep.memory.holding));
            }
            else {
                if(creep.room.controller.reservation && !isMe(creep.room.controller.reservation.username)){
                    if(creep.attackController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.controller)
                    }
                }
                else if(creep.room.controller.owner && !isMe(creep.room.controller.owner.username)){
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
                        if(!holding)return;
                        if(!holding.targetIdx) holding.targetIdx = randomInt(SIGNS.length-1)+'';
                        //console.log("targetIndex",holding.targetIdx);
                        let targetText = SIGNS[holding.targetIdx]
                        //console.log("TargetText",targetText)
                        if(creep.room.controller.sign && creep.room.controller.sign.text && creep.room.controller.sign.text != targetText){
                            creep.signController(creep.room.controller,targetText);
                        }
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
        else if(creep.memory.job == 'declaimer'){
            if(!creep.memory.preflight){
                Memory.flag1 = Game.time;
                creep.memory.preflight = true;
            }
            targetRoom = creep.memory.targetRoom
            if(targetRoom){
                if(creep.room.name != targetRoom){
                    creep.travelTo(new RoomPosition(16,30,targetRoom));
                }
                else {
                    creep.travelTo(creep.room.controller)
                    if(creep.memory.goFlag)creep.attackController(creep.room.controller)
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

