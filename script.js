// ===================================================
// 1. On récupère les éléments HTML qu'on va manipuler
// ===================================================
const video  = document.getElementById('camera');
const status = document.getElementById('status');
const info   = document.getElementById('info');

// ===================================================
// 2. On crée l'objet "Hands" de MediaPipe.
//    Il sait analyser une image et trouver les mains.
// ===================================================
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

// Options : 1 seule main, qualité moyenne
hands.setOptions({
  maxNumHands: 1,
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

function isHandOpen(landmarks) {
  const wrist = landmarks[0];
  const tips  = [8, 12, 16, 20];
  const pips  = [6, 10, 14, 18];
  let extended = 0;
  for (let i = 0; i < tips.length; i++) {
    if (distance(landmarks[tips[i]], wrist) >
        distance(landmarks[pips[i]], wrist)) {
      extended++;
    }
  }
  return extended >= 3; // main ouverte = au moins 3 doigts tendus
}

// Geste de scroll : POUCE + INDEX repliés
//   - index plié : bout (8) plus proche du poignet que l'articulation (6)
//   - pouce plié : bout (4) proche de la base de l'index (5),
//     normalisé par la taille de la paume (distance 0 → 5)
function isThumbAndIndexClosed(landmarks) {
  const wrist = landmarks[0];

  const indexFolded =
    distance(landmarks[8], wrist) < distance(landmarks[6], wrist);

  const palmSize    = distance(landmarks[0], landmarks[5]);
  const thumbFolded = distance(landmarks[4], landmarks[5]) < palmSize * 0.6;

  return indexFolded && thumbFolded;
}

// ===================================================
// 5. Réagir aux résultats : on modifie le CSS
//    et on fait défiler la page.
// ===================================================
function onResults(results) {
  // Aucune main détectée
  if (!results.multiHandLandmarks ||
      results.multiHandLandmarks.length === 0) {
    status.textContent = '🙈 Aucune main';
    return;
  }

  const landmarks = results.multiHandLandmarks[0];

  // ✋ Main ouverte → on AFFICHE la boîte info
  // ✊ Sinon       → on la CACHE
  if (isHandOpen(landmarks)) {
    info.style.display = 'flex';
  } else {
    info.style.display = 'none';
  }

  // 🤏 Si POUCE + INDEX sont fermés → on fait défiler la page
  //    selon la position verticale du poignet.
  //
  // landmarks[0].y = position verticale du poignet,
  //   entre 0 (haut de la webcam) et 1 (bas).
  //
  //  - main en HAUT de l'image  → scroll vers le HAUT
  //  - main en BAS de l'image   → scroll vers le BAS
  //  - main au milieu           → zone morte (pas de scroll)
  if (isThumbAndIndexClosed(landmarks)) {
    const y = landmarks[0].y;
    if (y < 0.4) {
      status.textContent = '🤏⬆️ Scroll haut';
      window.scrollBy({ top: -20, behavior: 'auto' });
    } else if (y > 0.6) {
      status.textContent = '🤏⬇️ Scroll bas';
      window.scrollBy({ top: 20, behavior: 'auto' });
    } else {
      status.textContent = '🤏 Pouce + index fermés (zone morte)';
    }
  } else if (isHandOpen(landmarks)) {
    status.textContent = '✋ Main ouverte';
  } else {
    status.textContent = '✊ Main fermée';
  }
}
