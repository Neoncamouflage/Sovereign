//At the top of main.js, this import the module with your tower code
const roleTowerDefense = require('roleTowerDefense');

//Also in main.js, loop through all the rooms you can access through Game.rooms
for(room in Game.rooms){
    //Assign the current room you're looking at to the variable `myRoom`
    let myRoom = Game.rooms[myRoom];
    //Using the room object assigned to `myRoom`, call `.find()` to get all structures, plus an optional filter to only get tower structures
    //`towers` is now an array containing the game objects of all towers in that room
    let towers = myRoom.find(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_TOWER}});

    //Loop through every tower in the array and call the `run()` function from your tower code on it
    for(myTower of towers){
        //We pass `myTower` to the function so that the function can reference it
        roleTowerDefense.run(myTower);
    }
}

//In roleTowerDefense.js, this is your role code
const roleTowerDefense = {
    //This is the `run()` function called from the main file, `tower` refers to the `myTower` you passed to it in your  main code
    run:function(tower){
    }
}
//Export the object `roleTowerDefense` that contains our function
module.exports = roleTowerDefense;


function initTable(tableSize,path){
    path.MemoryTable = new Array(tableSize);
}

global.initTable = fiefPlanner.initTable;