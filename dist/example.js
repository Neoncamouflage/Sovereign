//Module Overview

//In main.js
//If you need to use another file, assign it to a variable so you can reference it
const harvester = require('role.harvester')

module.exports.loop = function () {

  //In your loop, you can use the functions from the other files
  //Like as a way to run role-specific code for your creeps
  for(let creep of Object.values(Game.creeps)){
    if(creep.memory.role == 'harvester'){
      //This calls the run() function inside the harvester file, and passes the creep to it
      harvester.run(creep)
    }
  }
}

//In role.harvester.js
//We define an object to hold the functions we want the rest of our code to access
const roleHarvester = {
  //Define the function we plan to call
  run: function(creep){
    //Code for our creep to do when we call it
  },
  //We can define  multiple functions if we want, and anything importing the file can use them
  getName: function(){
    //Code to generate a harvester name
  }
}

//Export the object holding all our functions
module.exports = roleHarvester;

