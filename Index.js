// =======================================================
// Tile Hole Master - Universal Smart Bot (Robotmon)
// =======================================================

// --- CONFIGURATION ---
// Starting hole position (center bottom of game area)
var holeX = 540; 
var holeY = 1100;

// SAFE DISTANCE FROM BOMBS (pixels)
var BOMB_SAFETY_RADIUS = 150; 

// --- COLOR DETECTION PROFILES ---

// 1. Dark Bombs & Hazards (Black / Dark Grey)
var BOMB_COLOR = {
  minB: 0, maxB: 50,
  minG: 0, maxG: 50,
  minR: 0, maxR: 50,
  minA: 0, maxA: 255
};

// 2. White Cubes & Blocks (Burger boxes, white tiles)
var WHITE_CUBE_COLOR = {
  minB: 180, maxB: 255,
  minG: 180, maxG: 255,
  minR: 180, maxR: 255,
  minA: 0,   maxA: 255
};

// 3. Yellow / Orange Fruits
var YELLOW_FRUIT_COLOR = {
  minB: 0,   maxB: 120,
  minG: 140, maxG: 255,
  minR: 200, maxR: 255,
  minA: 0,   maxA: 255
};

// 4. Red / Pink / Blue Colored Pegs & Tiles
var BRIGHT_TILE_COLOR = {
  minB: 50,  maxB: 255,
  minG: 0,   maxG: 180,
  minR: 150, maxR: 255,
  minA: 0,   maxA: 255
};

// --- ANTI-STUCK TRACKING ---
var lastTargetTime = Date.now();
var STUCK_THRESHOLD_MS = 2000; 

// --- HELPER FUNCTIONS ---

function getDistance(x1, y1, x2, y2) {
  var dx = x1 - x2;
  var dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// Checks if target coordinates fall within a bomb danger radius
function isSafe(targetX, targetY, bombContours) {
  if (!bombContours || bombContours.length === 0) return true;
  
  for (var i = 0; i < bombContours.length; i++) {
    var bomb = bombContours[i];
    if (getDistance(targetX, targetY, bomb.x, bomb.y) < BOMB_SAFETY_RADIUS) {
      return false; 
    }
  }
  return true;
}

// Drags hole smoothly from its current position to target coordinates
function dragHoleTo(targetX, targetY) {
  touchDown(holeX, holeY, 0);
  sleep(30);
  
  // Interpolate movement to move smoothly
  var steps = 3;
  for (var s = 1; s <= steps; s++) {
    var stepX = Math.round(holeX + (targetX - holeX) * (s / steps));
    var stepY = Math.round(holeY + (targetY - holeY) * (s / steps));
    touchMove(stepX, stepY, 0);
    sleep(25);
  }
  
  touchUp(0);
  
  // Update current tracked position of the hole
  holeX = targetX;
  holeY = targetY;
}

// Wide perimeter sweep if no target found or hole is stuck
function runAntiStuckSweep() {
  touchDown(200, 500, 0);
  sleep(40);
  touchMove(880, 500, 0);
  sleep(150);
  touchMove(880, 1300, 0);
  sleep(150);
  touchMove(200, 1300, 0);
  sleep(150);
  touchUp(0);
  
  // Reset default hole tracking position to center
  holeX = 540;
  holeY = 1100;
}

// --- MAIN BOT ENGINE ---

function runSmartBot() {
  var img = getScreenshot();

  // 1. Detect Bombs
  var bombMask = inRange(
    img, 
    BOMB_COLOR.minB, BOMB_COLOR.minG, BOMB_COLOR.minR, BOMB_COLOR.minA,
    BOMB_COLOR.maxB, BOMB_COLOR.maxG, BOMB_COLOR.maxR, BOMB_COLOR.maxA
  );
  var bombContours = findContours(bombMask, 60, 5000);

  // 2. Scan for ALL valid target types (Cubes, Fruits, Colored Pegs)
  var allTargets = [];

  var targetColors = [WHITE_CUBE_COLOR, YELLOW_FRUIT_COLOR, BRIGHT_TILE_COLOR];

  for (var c = 0; c < targetColors.length; c++) {
    var color = targetColors[c];
    var mask = inRange(img, color.minB, color.minG, color.minR, color.minA, color.maxB, color.maxG, color.maxR, color.maxA);
    var contours = findContours(mask, 80, 12000);
    
    if (contours && contours.length > 0) {
      for (var k = 0; k < contours.length; k++) {
        allTargets.push(contours[k]);
      }
    }
    releaseImage(mask);
  }

  // 3. Find closest safe target to current hole position
  var bestTarget = null;
  var shortestDistance = 99999;

  for (var i = 0; i < allTargets.length; i++) {
    var target = allTargets[i];

    if (isSafe(target.x, target.y, bombContours)) {
      var dist = getDistance(holeX, holeY, target.x, target.y);
      if (dist < shortestDistance) {
        shortestDistance = dist;
        bestTarget = target;
      }
    }
  }

  // 4. Action Execution
  if (bestTarget) {
    dragHoleTo(bestTarget.x, bestTarget.y);
    lastTargetTime = Date.now();
  } else {
    if (Date.now() - lastTargetTime > STUCK_THRESHOLD_MS) {
      runAntiStuckSweep();
      lastTargetTime = Date.now();
    }
  }

  // 5. Release memory
  releaseImage(img);
  releaseImage(bombMask);
}

// --- MAIN LOOP ---
while (true) {
  runSmartBot();
  sleep(40);
}
