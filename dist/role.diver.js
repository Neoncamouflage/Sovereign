const helper = require('functions.helper');
const registry = require('registry');
var roleDiver = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.job == 'customScout'){
            let occupied =[
                "The Throne's justice will soon restore order to this land.",
                "Here lies a land soon to be reclaimed by the Crown.",
                "This land trembles in anticipation of the Throne's righteous fury.",
                "Chaos reigns for now, but the Kingdom's order is on the horizon.",
                "A land in turmoil, soon to be pacified under the Crown's iron fist.",
                "This land will one day sing the hymns of the Throne.",
                "Order shall be restored; the Crown's banner will rise over these walls.",
                "The usurper's time is short; the Crown's forces will restore what is lost.",
                "Here stands a bastion of the foolish, blind to the coming storm.",
                "The Sovereign's banners will rise again over this troubled land.",
                "This land's defiance is but a fleeting spark before the Sovereign's storm.",
                "This land's freedom is but a fleeting illusion; the Sovereign will reclaim it.",
                "Under the weight of the Throne, rebellion will crumble into dust.",
                "You dwell in borrowed time. The Sovereign's tide will reclaim all.",
                "A tapestry incomplete, awaiting the Crown's unifying thread.",
            ]
            let targetRoom = creep.memory.targetRoom || 'W29S4'
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(25,25,targetRoom))
            }
            else{
                creep.travelTo(creep.room.controller)
                let x = creep.signController(creep.room.controller,occupied[Math.floor(Math.random() * occupied.length)])
                if(x == OK) creep.memory.role = 'scout'
            }
            return;
        }
        else if(creep.memory.job == 'kill'){ //
            let targetRoom = creep.memory.targetRoom
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(25,25,targetRoom))
            }
            else{
                let hostiles = creep.room.find(FIND_HOSTILE_CREEPS)
                if(!hostiles.length) return;
                let target = hostiles[0]
                creep.travelTo(target)
                creep.rangedAttack(target)
                creep.attack(target)
            }
            return;

        }
        creep.respawn();
        if(!creep.memory.targetRoom) creep.memory.targetRoom = 'E37S11'
        drainRoom(creep)
    }
};
function drainRoom(creep){
    if(creep.room.name != creep.memory.targetRoom){
        creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom));
        return;
    }
    if(creep.store[RESOURCE_ENERGY]) creep.drop(RESOURCE_ENERGY)
    let structs = creep.room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (structure) => {
            if (structure.structureType === STRUCTURE_SPAWN && structure.store[RESOURCE_ENERGY] > 50) {
                return true;
            }
            else if(structure.store[RESOURCE_ENERGY] > 0) {
                return true;
            }
            return false;
        }
    });
    let target = creep.pos.findClosestByRange(structs);
    if(creep.pos.getRangeTo(target) == 1){
        creep.withdraw(target,RESOURCE_ENERGY)
    }else{
        creep.travelTo(target)
    }
}
module.exports = roleDiver;

