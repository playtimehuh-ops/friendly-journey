// =======================================================
// Tile Hole Master - Smart OpenCV Bot (Mobile Robotmon)
// =======================================================

// --- CONFIGURATION ---
// Adjust to match your phone screen's hole starting position
var HOLE_X = 540; 
var HOLE_Y = 1200;

// Bomb/Hazard Detection (BGR Format: Dark pixels / Black bombs)
var BOMB_COLOR = {
  minB: 0,   maxB: 50,
  minG: 0,   maxG: 50,
  minR: 0,   maxR: 50,
  minA: 0,   maxA: 255
};

// Fruit Target Detection (BGR Format: Example set for Yellow/Orange fruits)
var FRUIT_COLOR = {
  minB: 0,   maxB: 100,
  minG: 150, maxG: 255,
  minR: 200, maxR: 255,
  minA: 0,   maxA: 255
};

// Minimum safe distance in pixels away from any detected bomb
var BOMB_SAFETY_RADIUS = 160; 

// Anti-Stuck Tracking
var lastTargetTime = Date.now();
var STUCK_THRESHOLD_MS = 2000; // 2 seconds without target triggers sweep

// --- HELPER FUNCTIONS ---

// Distance math formula
function getDistance(x1, y1, x2, y2) {
  var dx = x1 - x2;
  var dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// Checks if a target coordinate is too close to any detected bomb
function isTargetSafe(targetX, targetY, bombContours) {
  if (!bombContours || bombContours.length === 0) return true;
  
  for (var i = 0; i < bombContours.length; i++) {
    var bomb = bombContours[i];
    var dist = getDistance(targetX, targetY, bomb.x, bomb.y);
    if (dist < BOMB_SAFETY_RADIUS) {
      return false; // Target is inside bomb danger zone
    }
  }
  return true;
}

// Moves hole toward target coordinates
function moveHoleTo(targetX, targetY) {
  touchDown(HOLE_X, HOLE_Y, 0);
  sleep(20);
  touchMove(targetX, targetY, 0);
  sleep(100);
  touchUp(0);
}

// Anti-Stuck Logic: Performs wide sweep across edges if trapped or no targets found
function runAntiStuckSweep() {
  // Swipe across top edge
  touchDown(100, 400, 0);
  sleep(30);
  touchMove(980, 400, 0);
  sleep(150);
  touchUp(0);
  
  // Swipe back down middle
  touchDown(540, 400, 0);
  sleep(30);
  touchMove(540, 1400, 0);
  sleep(150);
  touchUp(0);
}

// --- MAIN DECISION ENGINE ---

function runSmartBot() {
  // 1. Capture Screen
  var img = getScreenshot();

  // 2. Detect Bombs Mask
  var bombMask = inRange(
    img, 
    BOMB_COLOR.minB, BOMB_COLOR.minG, BOMB_COLOR.minR, BOMB_COLOR.minA,
    BOMB_COLOR.maxB, BOMB_COLOR.maxG, BOMB_COLOR.maxR, BOMB_COLOR.maxA
  );
  var bombContours = findContours(bombMask, 80, 5000);

  // 3. Detect Fruit Tiles Mask
  var fruitMask = inRange(
    img, 
    FRUIT_COLOR.minB, FRUIT_COLOR.minG, FRUIT_COLOR.minR, FRUIT_COLOR.minA,
    FRUIT_COLOR.maxB, FRUIT_COLOR.maxG, FRUIT_COLOR.maxR, FRUIT_COLOR.maxA
  );
  var fruitContours = findContours(fruitMask, 100, 10000);

  // 4. Evaluate Targets (Prioritize Top/Outer safe tiles)
  var bestTarget = null;
  var topYPosition = 99999; // Lower Y = higher up on screen (top layer priority)

  if (fruitContours && fruitContours.length > 0) {
    for (var i = 0; i < fruitContours.length; i++) {
      var tile = fruitContours[i];

      // Check if tile is clear of bomb danger zones
      if (isTargetSafe(tile.x, tile.y, bombContours)) {
        if (tile.y < topYPosition) {
          topYPosition = tile.y;
          bestTarget = tile;
        }
      }
    }
  }

  // 5. Execute Action
  if (bestTarget) {
    moveHoleTo(bestTarget.x, bestTarget.y);
    lastTargetTime = Date.now(); // Reset anti-stuck timer
  } else {
    // If no safe target found for 2 seconds, execute anti-stuck perimeter sweep
    if (Date.now() - lastTargetTime > STUCK_THRESHOLD_MS) {
      runAntiStuckSweep();
      lastTargetTime = Date.now();
    }
  }

  // 6. Memory Cleanup (Crucial to prevent app crashes on Android)
  releaseImage(img);
  releaseImage(bombMask);
  releaseImage(fruitMask);
}

// --- MAIN EXECUTION LOOP ---
while (true) {
  runSmartBot();
  sleep(50); // Frame throttle (~20 FPS)
}
