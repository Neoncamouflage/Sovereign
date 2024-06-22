const roomDimensions = 50

/**
 * This is good for anything that isn't a diagonal, as searches all adjacent tiles when finding distance
 */
//Enable visuals removed
/*     
if (enableVisuals) {
    // Loop through the xs and ys inside the bounds

    for (x = x1; x <= x2; x += 1) {
        for (y = y1; y <= y2; y += 1) {
            room.visual.rect(x - 0.5, y - 0.5, 1, 1, {
                fill: `hsl(${200}${distanceCM.get(x, y) * 10}, 100%, 60%)`,
                opacity: 0.4,
            })
        }
    }
}*/
Room.prototype.distanceTransform = function (
    initialCM = null,
    x1 = 0,
    y1 = 0,
    x2 = roomDimensions - 1,
    y2 = roomDimensions - 1,
) {
    const room = this

    if(!initialCM){
        initialCM = new PathFinder.CostMatrix();
        const terrain = new Room.Terrain(room.name);
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                const tile = terrain.get(x, y);
                const weight =
                    tile === TERRAIN_MASK_WALL  ? 255 : // wall  => unwalkable
                    tile === TERRAIN_MASK_SWAMP ?   5 : // swamp => weight:  5
                                                    1 ; // plain => weight:  1
                initialCM.set(x, y, weight);
            }
        }
    }

    // Use a costMatrix to record distances

    const distanceCM = new PathFinder.CostMatrix()

    let x
    let y

    for (x = Math.max(x1 - 1, 0); x < Math.min(x2 + 1, roomDimensions - 1); x += 1) {
        for (y = Math.max(y1 - 1, 0); y < Math.min(y2 + 1, roomDimensions - 1); y += 1) {
            distanceCM.set(x, y, initialCM.get(x, y) === 255 ? 0 : 255)
        }
    }

    let top
    let left
    let topLeft
    let topRight
    let bottomLeft

    // Loop through the xs and ys inside the bounds

    for (x = x1; x <= x2; x += 1) {
        for (y = y1; y <= y2; y += 1) {
            top = distanceCM.get(x, y - 1)
            left = distanceCM.get(x - 1, y)
            topLeft = distanceCM.get(x - 1, y - 1)
            topRight = distanceCM.get(x + 1, y - 1)
            bottomLeft = distanceCM.get(x - 1, y + 1)

            distanceCM.set(x, y, Math.min(Math.min(top, left, topLeft, topRight, bottomLeft) + 1, distanceCM.get(x, y)))
        }
    }

    let bottom
    let right
    let bottomRight

    // Loop through the xs and ys inside the bounds

    for (x = x2; x >= x1; x -= 1) {
        for (y = y2; y >= y1; y -= 1) {
            bottom = distanceCM.get(x, y + 1)
            right = distanceCM.get(x + 1, y)
            bottomRight = distanceCM.get(x + 1, y + 1)
            topRight = distanceCM.get(x + 1, y - 1)
            bottomLeft = distanceCM.get(x - 1, y + 1)

            distanceCM.set(
                x,
                y,
                Math.min(Math.min(bottom, right, bottomRight, topRight, bottomLeft) + 1, distanceCM.get(x, y)),
            )
        }
    }

    return distanceCM
}

/**
 * This is good for finding open diamond-shaped areas, as it voids adjacent diagonal tiles when finding distance
 */
Room.prototype.diagonalDistanceTransform = function (
    initialCM,
    enableVisuals,
    x1 = 0,
    y1 = 0,
    x2 = roomDimensions - 1,
    y2 = roomDimensions - 1,
) {
    const room = this

    // Use a costMatrix to record distances

    const distanceCM = new PathFinder.CostMatrix()

    let x
    let y

    for (x = x1; x <= x2; x += 1) {
        for (y = y1; y <= y2; y += 1) {
            distanceCM.set(x, y, initialCM.get(x, y) === 255 ? 0 : 255)
        }
    }

    let top
    let left

    // Loop through the xs and ys inside the bounds

    for (x = x1; x <= x2; x += 1) {
        for (y = y1; y <= y2; y += 1) {
            top = distanceCM.get(x, y - 1)
            left = distanceCM.get(x - 1, y)

            distanceCM.set(x, y, Math.min(Math.min(top, left) + 1, distanceCM.get(x, y)))
        }
    }

    let bottom
    let right

    // Loop through the xs and ys inside the bounds

    for (x = x2; x >= x1; x -= 1) {
        for (y = y2; y >= y1; y -= 1) {
            bottom = distanceCM.get(x, y + 1)
            right = distanceCM.get(x + 1, y)

            distanceCM.set(x, y, Math.min(Math.min(bottom, right) + 1, distanceCM.get(x, y)))
        }
    }

    if (enableVisuals) {
        // Loop through the xs and ys inside the bounds

        for (x = x1; x <= x2; x += 1) {
            for (y = y1; y <= y2; y += 1) {
                room.visual.rect(x - 0.5, y - 0.5, 1, 1, {
                    fill: `hsl(${200}${distanceCM.get(x, y) * 10}, 100%, 60%)`,
                    opacity: 0.4,
                })
            }
        }
    }

    return distanceCM
}