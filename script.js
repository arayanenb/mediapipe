// ===================================================
// 1. On récupère les éléments HTML qu'on va manipuler
// ===================================================
const video  = document.getElementById('camera');
const status = document.getElementById('status');
const info   = document.getElementById('info');
const body   = document.body;
const scrollTopButton = document.getElementById('scrollTopButton');

scrollTopButton.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function setHidden(shouldHide) {
  if (shouldHide) {
    body.classList.add('hidden');
  } else {
    body.classList.remove('hidden');
  }
}

// ===================================================
// 2. On crée l'objet "Hands" de MediaPipe.
//    Il sait analyser une image et trouver les mains.
// ===================================================
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

// Options : jusqu'à 2 mains, qualité moyenne
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5
});

// À chaque image analysée, MediaPipe appelle "onResults"
hands.onResults(onResults);

// ===================================================
// 3. On allume la webcam et on envoie chaque frame
//    à MediaPipe pour analyse.
// ===================================================
const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});
camera.start();

// ===================================================
// 4. Détecter si la main est ouverte
//
// MediaPipe renvoie 21 points (landmarks) par main.
//   - 0  = poignet
//   - 8  = bout de l'index       | 6  = articulation
//   - 12 = bout du majeur        | 10 = articulation
//   - 16 = bout de l'annulaire   | 14 = articulation
//   - 20 = bout de l'auriculaire | 18 = articulation
//
// Astuce : si le bout du doigt est plus LOIN du poignet
// que son articulation, c'est que le doigt est tendu.
// ===================================================
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getPalmSize(landmarks) {
  return distance(landmarks[0], landmarks[5]);
}

function isThreeFingerPinch(landmarks) {
  const palmSize = getPalmSize(landmarks);
  const thumbIndex = distance(landmarks[4], landmarks[8]);
  const thumbMiddle = distance(landmarks[4], landmarks[12]);
  const indexMiddle = distance(landmarks[8], landmarks[12]);

  return thumbIndex < palmSize * 0.4 &&
         thumbMiddle < palmSize * 0.4 &&
         indexMiddle < palmSize * 0.5;
}

function getHandRoll(landmarks) {
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  return Math.atan2(pinkyMcp.y - indexMcp.y, pinkyMcp.x - indexMcp.x);
}

function isThumbsUp(landmarks) {
  const wrist = landmarks[0];
  const palmSize = distance(landmarks[0], landmarks[5]);

  const thumbExtended =
    distance(landmarks[4], landmarks[5]) > palmSize * 0.8;
  const indexFolded =
    distance(landmarks[8], wrist) < distance(landmarks[6], wrist);
  const middleFolded =
    distance(landmarks[12], wrist) < distance(landmarks[10], wrist);
  const ringFolded =
    distance(landmarks[16], wrist) < distance(landmarks[14], wrist);
  const pinkyFolded =
    distance(landmarks[20], wrist) < distance(landmarks[18], wrist);

  return thumbExtended && indexFolded && middleFolded && ringFolded && pinkyFolded;
}

function isBothHandsThumbsUp(results) {
  return results.multiHandLandmarks.length >= 2 &&
         isThumbsUp(results.multiHandLandmarks[0]) &&
         isThumbsUp(results.multiHandLandmarks[1]);
}

// ===================================================
// 5. Réagir aux résultats : on modifie le CSS
//    et on fait défiler la page.
// ===================================================
function onResults(results) {
  // Aucune main détectée
  if (!results.multiHandLandmarks ||
      results.multiHandLandmarks.length === 0) {
    setHidden(false);
    status.textContent = '🙈 Aucune main';
    return;
  }

  if (isBothHandsThumbsUp(results)) {
    setHidden(false);
    info.style.display = 'none';
    status.textContent = '👍👍 Deux thumbs-up détectés — fermeture du navigateur';
    window.close();
    return;
  }

  const landmarks = results.multiHandLandmarks[0];

  if (results.multiHandLandmarks.length === 1 && isThumbsUp(landmarks)) {
    setHidden(true);
    status.textContent = '👍 Thumbs-up détecté — site caché';
    return;
  }

  setHidden(false);

  if (isThreeFingerPinch(landmarks)) {
    info.style.display = 'flex';
    const roll = getHandRoll(landmarks);

    if (roll < -0.25) {
      status.textContent = '🤏↪️ Pinch + twist à droite → scroll haut';
      window.scrollBy({ top: -40, behavior: 'auto' });
    } else if (roll > 0.25) {
      status.textContent = '🤏↩️ Pinch + twist à gauche → scroll bas';
      window.scrollBy({ top: 40, behavior: 'auto' });
    } else {
      status.textContent = '🤏 Pinch détecté — twist à droite ou à gauche pour scroller';
    }
  } else {
    info.style.display = 'none';
    status.textContent = '✊ Main fermée ou geste non reconnu';
  }
}
