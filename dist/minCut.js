// the eight surrounding points of a tile
// note the order here is somehow important, the element i and (i + 4) % 8 should be the opposite direction
const EIGHT_DELTA = [
	{ x: 0, y: -1 }, // TOP
	{ x: 1, y: -1 }, // TOP_RIGHT
	{ x: 1, y: 0 }, // RIGHT
	{ x: 1, y: 1 }, // BOTTOM_RIGHT
	{ x: 0, y: 1 }, // BOTTOM
	{ x: -1, y: 1 }, // BOTTOM_LEFT
	{ x: -1, y: 0 }, // LEFT
	{ x: -1, y: -1 } // TOP_LEFT
  ]
  
  /**
   * pack x-y pairs in 12-bit integers, assuming both x and y in [0, 49]
   */
  function calcIdx(x, y) {
	return (y << 6) | x
  }
  
  /**
   * unpack the 12-bit integer into x-y pair
   */
  function calcPt(v) {
	return { x: v & 0x3f, y: v >> 6 }
  }
  
  function isPointInRoom(p) {
	return p.x >= 0 && p.x <= 49 && p.y >= 0 && p.y <= 49
  }
  
  function pointAdd(a, b) {
	return { x: a.x + b.x, y: a.y + b.y }
  }
  
  function surroundingPoints(p) {
	return EIGHT_DELTA.map(d => pointAdd(p, d)).filter(isPointInRoom)
  }
  
  class Int32Queue {
	constructor(capacity) {
	  this.q = new Int32Array(capacity)
	  this.h = this.t = 0
	}
  
	reset(arr) {
	  this.q.set(arr)
	  this.h = 0
	  this.t = arr.length
	}
  
	push(v) {
	  this.q[this.t] = v
	  this.t = (this.t + 1) % this.q.length
	}
  
	shift() {
	  const v = this.q[this.h]
	  this.h = (this.h + 1) % this.q.length
	  return v
	}
  
	get length() {
	  return (this.t - this.h + this.q.length) % this.q.length
	}
  
	clear() {
	  this.t = this.h = 0
	}
  }
  
  const MAX_PT = 1 << 12
  const PT_MASK = MAX_PT - 1
  
  // the bit to indicate a d-node in the 13-bits node id
  const D_NODE = 1 << 12
  
  // max encoded node id, there can only be at most 5000 nodes in the graph, some
  // spaces are wasted
  const MAX_NODE = 1 << 13
  
  // the edge connecting s-node and d-node
  const REV_EDGE = 1 << 16
  
  // direction shift in the encoded edge
  const DIR_SHIFT = 13
  
  function minCutToExit(sources, costMap) {
	// an array indicating whether a point is at the exit or near the exit
	const exit = new Uint8Array(MAX_PT)
	for (let i = 0; i < 49; ++i) {
	  for (const [x, y] of [
		[i, 0],
		[49, i],
		[49 - i, 49],
		[0, 49 - i]
	  ]) {
		if (costMap.get(x, y) == 255) {
		  continue
		}
		exit[calcIdx(x, y)] = 1
		for (const p of surroundingPoints({ x, y })) {
		  exit[calcIdx(p.x, p.y)] = 1
		}
	  }
	}
  
	for (const s of sources) {
	  if (exit[calcIdx(s.x, s.y)]) {
		throw new Error(`Invalid source ${s.x},${s.y}`)
	  }
	}
  
	// setup the capacity map, the keys are the encoded edges
	// 0-12 bits    - source node
	//   0-11 bits      - the packed location of the source node
	//   12 bit         - s-node or the d-node
	// 13-16 bits   - direction of the edge, 0-7 means the edge goes to another
	// location, while 8 means the edge goes from s-node to d-node or vice versa
	const capacityMap = new Int32Array(1 << 17)
	capacityMap.fill(0)
	for (let y = 0; y < 50; ++y) {
	  for (let x = 0; x < 50; ++x) {
		if (costMap.get(x, y) == 255) {
		  continue
		}
  
		const idx = calcIdx(x, y)
  
		// setting up the capacity of the edge from s-node to the d-node at the
		// location x,y
		capacityMap[idx | REV_EDGE] = costMap.get(x, y)
  
		// setting up the capacity of the edges from d-node to s-nodes of the
		// surrounding locations
		for (let dir = 0; dir < EIGHT_DELTA.length; ++dir) {
		  const np = pointAdd({ x, y }, EIGHT_DELTA[dir]) // next point
		  if (!isPointInRoom(np)) {
			continue
		  }
  
		  if (costMap.get(np.x, np.y) == 255) {
			continue
		  }
  
		  capacityMap[idx | D_NODE | (dir << DIR_SHIFT)] = 10000 // almost infinite
		}
	  }
	}
  
	// storing the previous node, and the edge direction in the path found from
	// the sources to the sinks the keys are the encoded nodes the values are
	//   -2: the node is not visited
	//   -1: the node is in the sources set
	//   (direction << 16) | prev_node_id: by which node the current node is
	//   visited, and the direction of the edge
	const last = new Int32Array(MAX_NODE)
	last.fill(-2)
  
	// whether or not a node is in the bfsQ
	const added = new Uint8Array(MAX_NODE)
	added.fill(0)
  
	// the queue for bfs
	const bfsQ = new Int32Queue(MAX_NODE)
  
	for (const p of sources) {
	  const pidx = calcIdx(p.x, p.y)
	  last[pidx] = -1
	  added[pidx] = 1
	  bfsQ.push(pidx)
	}
  
	// bfs to find a path from the sources to the sinks, returns the sink point or
	// null if no path is found
	const bfs = () => {
	  while (bfsQ.length) {
		const opidx = bfsQ.shift() // original node id
		added[opidx] = 0
  
		if (last[opidx] == -2) {
		  // if the node is no-longer reachable from the sources, skip it
		  // this can happen during the loosen operation below, after we reduce
		  // the capacity of some edges to zero, the descendants of the node may
		  // become unreachable and requires a next bfs round to be re-discovered
  
		  continue
		}
  
		// checking the edge to its counterpart, from s-node to d-node or vice versa
		if (capacityMap[opidx | REV_EDGE]) {
		  const onpidx = opidx ^ D_NODE // the counterpart node id
		  if (last[onpidx] == -2) {
			last[onpidx] = (8 << 16) | opidx
  
			// note that we don't need to check the `added` flag here, in `bfs`
			// we won't add a node to the queue twice
			added[onpidx] = 1
			bfsQ.push(onpidx)
		  }
		}
  
		// checking the edges to the surrounding nodes
		const pidx = opidx & PT_MASK // the packed location of the node
		const p = calcPt(pidx)
		const npCounterpartFlag = (opidx ^ D_NODE) & D_NODE
		for (let dir = 0; dir < EIGHT_DELTA.length; ++dir) {
		  if (capacityMap[opidx | (dir << DIR_SHIFT)] == 0) {
			continue
		  }
  
		  const np = pointAdd(p, EIGHT_DELTA[dir]) // next point
		  const npidx = calcIdx(np.x, np.y)
  
		  // the destination node id, note that the D_NODE flag is different from the opidx node
		  // also note that we don't need to check if the next point is outside the room, this is impossible
		  const onpidx = npidx | npCounterpartFlag
  
		  if (exit[npidx]) {
			// exit! we successfully found a path from the sources to the sinks
			// here the last[onpidx] won't be -2, because it is guarenteed that
			// it is the first time this node is visited by this round of bfs
  
			// we will also leave the rest of nodes in the queue, and continue the bfs in the next iteration
			last[onpidx] = (dir << 16) | opidx
			return np
		  }
  
		  if (last[onpidx] != -2) {
			continue
		  }
  
		  last[onpidx] = (dir << 16) | opidx
		  added[onpidx] = 1
		  bfsQ.push(onpidx)
		}
	  }
  
	  return null
	}
  
	// given a node and a dir, return the destination node and the dir to return from source node
	const revEdge = (opidx, dir) => {
	  if (dir == 8) {
		return [opidx ^ D_NODE, 8]
	  }
  
	  const pidx = opidx & PT_MASK
	  const p = calcPt(pidx)
	  const np = pointAdd(p, EIGHT_DELTA[dir])
	  const onpidx = calcIdx(np.x, np.y) | ((opidx ^ D_NODE) & D_NODE)
	  return [onpidx, (dir + 4) % 8]
	}
  
	// a queue for the traversal in the loosen operation, to find nodes whose reachability from the sources changes
	const looseQ = new Int32Queue(MAX_NODE)
  
	// a queue for the adding back nodes to the bfsQ in the loosen operation
	const readdQ = new Int32Queue(MAX_NODE)
  
	// the loosen operation, called with the sink point found by bfs, would do 3 things
	//   1. go through the path from the sources to this sink, finding the minimum capacity of the edges in the path,
	//      substract the minimum capacity from all the edges in the path, and add it to all the reverse edges
	//   2. using another bfs to find all the nodes whose reachability from the sources changes, with the looseQ, reset
	//      their last[] to -2, and add them to the readdQ
	//   3. for each the nodes in the readdQ, add all the source-reachable nodes with a non-zero-capacity edge to this node
	//      back to the bfsQ, so the next iteration can continue from these nodes
	const loosen = p => {
	  // step 1.a: find the minimum capacity
	  let minCapacity = Infinity
	  let highestPt = -1 // the closest node in the path to the sources, where the edge from it is one of the minimum capacity edges
	  // we will start from here to find all the nodes whose reachability from the sources changes
	  for (let res = last[calcIdx(p.x, p.y)]; res != -1; ) {
		const l = res & 0xffff
		const d = res >> 16
		const capacity = capacityMap[l | (d << DIR_SHIFT)]
		if (capacity <= minCapacity) {
		  minCapacity = capacity
		  highestPt = l
		}
		res = last[l]
	  }
  
	  // step 1.b: loosen the edges
	  for (let res = last[calcIdx(p.x, p.y)]; res != -1; ) {
		const l = res & 0xffff
		const d = res >> 16
		capacityMap[l | (d << DIR_SHIFT)] -= minCapacity
  
		const [rl, rd] = revEdge(l, d)
		capacityMap[rl | (rd << DIR_SHIFT)] += minCapacity
  
		res = last[l]
	  }
  
	  // step 2: find all the nodes whose reachability from the sources changes
	  // we follows the last[] direction instead of the capacityMap[]
	  looseQ.push(highestPt)
	  while (looseQ.length) {
		const opidx = looseQ.shift()
  
		// counterpart
		{
		  const onpidx = opidx ^ D_NODE
		  if (last[onpidx] == (opidx | (8 << 16))) {
			last[onpidx] = -2
			looseQ.push(onpidx)
			readdQ.push(onpidx)
		  }
		}
  
		const pidx = opidx & PT_MASK
		const p = calcPt(pidx)
		const npCounterpartFlag = (opidx ^ D_NODE) & D_NODE
  
		for (let dir = 0; dir < EIGHT_DELTA.length; ++dir) {
		  const np = pointAdd(p, EIGHT_DELTA[dir])
		  const onpidx = calcIdx(np.x, np.y) | npCounterpartFlag
  
		  if (last[onpidx] == (opidx | (dir << 16))) {
			last[onpidx] = -2
			looseQ.push(onpidx)
			readdQ.push(onpidx)
		  }
		}
	  }
  
	  // step 3: add those nodes that can goes forward back to bfsQ
	  while (readdQ.length) {
		const opidx = readdQ.shift()
		for (let dir = 0; dir < EIGHT_DELTA.length + 1; ++dir) {
		  const [onpidx, rd] = revEdge(opidx, dir)
		  const pidx = onpidx & PT_MASK
		  if (
			last[onpidx] != -2 &&
			!exit[pidx] &&
			!added[onpidx] &&
			capacityMap[onpidx | (rd << DIR_SHIFT)]
		  ) {
			added[onpidx] = 1
			bfsQ.push(onpidx)
		  }
		}
	  }
	}
  
	// the main loop, loosen the graph until we can't find a path from the sources to the sinks
	for (let p = bfs(); p != null; p = bfs()) {
	  loosen(p)
	}
  
	// collecting the result, we do a bfs from source, and collect points where the edge between s-node and d-node has zero capacity
	// those points is what we need for the ramparts or walls
	const ret = []
	const visited = new Uint8Array(MAX_NODE)
	const q = sources.map(p => calcIdx(p.x, p.y))
	for (const p of q) {
	  visited[p] = 1
	}
  
	while (q.length) {
	  const sidx = q.shift()
	  const didx = sidx | D_NODE
	  const p = calcPt(sidx)
  
	  if (last[sidx] != -2 && last[didx] == -2) {
		ret.push(p)
	  }
  
	  for (const np of surroundingPoints(p)) {
		if (!isPointInRoom(np)) {
		  continue
		}
  
		if (visited[calcIdx(np.x, np.y)]) {
		  continue
		}
  
		if (costMap.get(np.x, np.y) == 255) {
		  continue
		}
  
		const npidx = calcIdx(np.x, np.y)
		visited[npidx] = 1
		q.push(npidx)
	  }
	}
  
	return ret
  }
  //planRamparts('W56N12',PathFinder.CostMatrix.deserialize(Memory.testBasePlanCM),PathFinder.CostMatrix.deserialize(Memory.minCutCM))
  function planRamparts(roomName,buildingCM,scoreCM,includeController=false) {
	let startCPU = Game.cpu.getUsed();
	const cm = new PathFinder.CostMatrix()
	cm._bits.fill(255)
	let terrain = Game.map.getRoomTerrain(roomName);
	
	for (let y = 0; y < 50; ++y) {
	  for (let x = 0; x < 50; ++x) {
		if (terrain.get(x, y) !== TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
			cm.set(x,y,1)
		}
		
	  }
	}
	let uniqueCoords = new Set();
	let roomStructs = []
	let roomController = global.heap.scoutData[roomName].controller
	//console.log(JSON.stringify(roomController))

	//Controller
	if(includeController){
		for (let cy = -1; cy <= 1; cy++) {
			for (let cx = -1; cx <= 1; cx++) {
				let newX = roomController.x + cx;
				let newY = roomController.y + cy;
				if (terrain.get(newX, newY) !== TERRAIN_MASK_WALL && newX >= 0 && newX < 50 && newY >= 0 && newY < 50) {
					let coordId = `${newX}:${newY}`;
					if (!uniqueCoords.has(coordId)) {
						uniqueCoords.add(coordId);
						roomStructs.push({ x: newX, y: newY });
						//scoreCM.set(newX,newY,255)
					}
				}
			}
		}
	}



	let sourcePoints = [];
	for (let y = 2; y < 48; y++) {
		for (let x = 2; x < 48; x++) {
			//Protect buildings except roads and links
			if(buildingCM.get(x,y) != 99 && buildingCM.get(x,y) != 95 && Memory.roomPlanReference[buildingCM.get(x,y)]){
				coordId = `${x}:${y}`;
				if (!uniqueCoords.has(coordId)) {
					uniqueCoords.add(coordId);
					roomStructs.push({ x: x, y: y });
					scoreCM.set(x,y,1)
				}
				for (let dy = -3; dy <= 3; dy++) {
					for (let dx = -3; dx <= 3; dx++) {
						newX = x + dx;
						newY = y + dy;
						if (terrain.get(newX, newY) !== TERRAIN_MASK_WALL && newX >= 2 && newX < 48 && newY >= 2 && newY < 48) {
							coordId = `${newX}:${newY}`;
							if (!uniqueCoords.has(coordId)) {
								uniqueCoords.add(coordId);
								roomStructs.push({ x: newX, y: newY });
								scoreCM.set(newX,newY,1)
							}
						}
					}
				}
			}
		}
	}
	roomStructs.forEach(spot=>{
		//sourcePoints.push(...surroundingPoints(spot))
	})
	//Memory.minCutCM = scoreCM.serialize();

	const result = minCutToExit(roomStructs, scoreCM)
	Memory.minCutResult = result;
	//console.log("Mincut CPU:",Game.cpu.getUsed()-startCPU)
	return [result,Game.cpu.getUsed()-startCPU];
  }
  
  module.exports = {planRamparts}
  global.planRamparts = planRamparts;