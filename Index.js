// =======================================================
// Tile Hole Master - Universal Robotmon Engine (Fixed)
// =======================================================

var isRunning = false;

// Default hole start location (Center bottom)
var holeX = 540;
var holeY = 1100;

var BOMB_SAFETY_RADIUS = 150;
var lastTargetTime = Date.now();
var STUCK_THRESHOLD_MS = 2000;

// Color Profiles (BGR Format)
var BOMB_COLOR  = { minB: 0,   maxB: 50,  minG: 0,   maxG: 50,  minR: 0,   maxR: 50,  minA: 0, maxA: 255 };
var WHITE_CUBE  = { minB: 180, maxB: 255, minG: 180, maxG: 255, minR: 180, maxR: 255, minA: 0, maxA: 255 };
var YELLOW_ITEM = { minB: 0,   maxB: 120, minG: 140, maxG: 255, minR: 200, maxR: 255, minA: 0, maxA: 255 };
var BRIGHT_TILE = { minB: 50,  maxB: 255, minG: 0,   maxG: 180, minR: 150, maxR: 255, minA: 0, maxA: 255 };

// Helper: Converts Robotmon's object {"0": {x,y}, "1": {x,y}} into an array
function parseRobotmonContours(contoursObj) {
  var list = [];
  if (!contoursObj) return list;
  for (var key in contoursObj) {
    if (Object.prototype.hasOwnProperty.call(contoursObj, key)) {
      list.push(contoursObj[key]);
    }
  }
  return list;
}

function getDistance(x1, y1, x2, y2) {
  var dx = x1 - x2;
  var dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function isSafe(targetX, targetY, bombList) {
  if (!bombList || bombList.length === 0) return true;
  for (var i = 0; i < bombList.length; i++) {
    var bomb = bombList[i];
    if (getDistance(targetX, targetY, bomb.x, bomb.y) < BOMB_SAFETY_RADIUS) {
      return false;
    }
  }
  return true;
}

function dragHoleTo(targetX, targetY) {
  // FIXED: Using correct Robotmon tapDown, moveTo, and tapUp APIs
  tapDown(holeX, holeY, 30);
  
  var steps = 3;
  for (var s = 1; s <= steps; s++) {
    var stepX = Math.round(holeX + (targetX - holeX) * (s / steps));
    var stepY = Math.round(holeY + (targetY - holeY) * (s / steps));
    moveTo(stepX, stepY, 25);
  }
  
  tapUp(targetX, targetY, 20);
  
  holeX = targetX;
  holeY = targetY;
}

function runAntiStuckSweep() {
  tapDown(200, 500, 40);
  moveTo(880, 500, 150);
  moveTo(880, 1300, 150);
  moveTo(200, 1300, 150);
  tapUp(200, 1300, 40);
  
  holeX = 540;
  holeY = 1100;
}

// Converts mask to Canny and extracts valid contour coordinates
function safeFindContours(maskImg) {
  var cannyImg = canny(maskImg, 50, 150, 3);
  var rawResults = findContours(cannyImg, 50, 20000);
  releaseImage(cannyImg);
  return parseRobotmonContours(rawResults);
}

function runSmartBot() {
  var img = getScreenshot();

  // 1. Detect Bombs
  var bombMask = inRange(
    img, 
    BOMB_COLOR.minB, BOMB_COLOR.minG, BOMB_COLOR.minR, BOMB_COLOR.minA,
    BOMB_COLOR.maxB, BOMB_COLOR.maxG, BOMB_COLOR.maxR, BOMB_COLOR.maxA
  );
  var bombList = safeFindContours(bombMask);

  // 2. Scan Target Types (White Cubes, Yellow Items, Bright Tiles)
  var allTargets = [];
  var colorProfiles = [WHITE_CUBE, YELLOW_ITEM, BRIGHT_TILE];

  for (var c = 0; c < colorProfiles.length; c++) {
    var color = colorProfiles[c];
    var mask = inRange(img, color.minB, color.minG, color.minR, color.minA, color.maxB, color.maxG, color.maxR, color.maxA);
    var targetsFound = safeFindContours(mask);
    
    for (var k = 0; k < targetsFound.length; k++) {
      allTargets.push(targetsFound[k]);
    }
    releaseImage(mask);
  }

  // 3. Find Closest Safe Target
  var bestTarget = null;
  var shortestDistance = 99999;

  for (var i = 0; i < allTargets.length; i++) {
    var target = allTargets[i];
    if (isSafe(target.x, target.y, bombList)) {
      var dist = getDistance(holeX, holeY, target.x, target.y);
      if (dist < shortestDistance) {
        shortestDistance = dist;
        bestTarget = target;
      }
    }
  }

  // 4. Move Hole or Sweep
  if (bestTarget) {
    dragHoleTo(bestTarget.x, bestTarget.y);
    lastTargetTime = Date.now();
  } else {
    if (Date.now() - lastTargetTime > STUCK_THRESHOLD_MS) {
      runAntiStuckSweep();
      lastTargetTime = Date.now();
    }
  }

  // 5. Memory Cleanup
  releaseImage(img);
  releaseImage(bombMask);
}

// Control functions invoked by index.html onPlay / onPause
function start() {
  isRunning = true;
  while (isRunning) {
    runSmartBot();
    sleep(40);
  }
}

function stop() {
  isRunning = false;
}
