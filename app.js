// ==========================================
// 1. THREE.JS SETUP
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 60;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// ==========================================
// 2. PARTICLE SYSTEM GENERATION
// ==========================================
const particleCount = 15000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
const targetPositions = new Float32Array(particleCount * 3); 

// Initial random spawn
for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 200;
    colors[i] = Math.random() * 0.8 + 0.2; // Keep colors bright
    targetPositions[i] = positions[i];
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
    size: 0.4,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.8
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

// ==========================================
// 3. SHAPE MATH (MORPHING TARGETS)
// ==========================================
const shapes = ['heart', 'saturn', 'sphere', 'lasandi'];
let currentShapeIndex = 0;

// Generate text points for the name "Lasandi"
const textPoints = [];
const tempCanvas = document.createElement('canvas');
tempCanvas.width = 600;
tempCanvas.height = 200;
const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
tempCtx.fillStyle = 'white';
tempCtx.font = 'bold 100px Arial';
tempCtx.textAlign = 'center';
tempCtx.textBaseline = 'middle';
tempCtx.fillText('Lasandi', 300, 100);
const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
for (let y = 0; y < tempCanvas.height; y += 2) {
    for (let x = 0; x < tempCanvas.width; x += 2) {
        const index = (y * tempCanvas.width + x) * 4;
        if (imgData[index + 3] > 128) {
            textPoints.push({ x: (x - 300) * 0.15, y: -(y - 100) * 0.15 });
        }
    }
}

function generateShape(shapeType) {
    for (let i = 0; i < particleCount; i++) {
        let x, y, z;
        const i3 = i * 3;

        if (shapeType === 'heart') {
            const t = Math.random() * Math.PI * 2;
            x = 16 * Math.pow(Math.sin(t), 3) + (Math.random() - 0.5);
            y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + (Math.random() - 0.5);
            z = (Math.random() - 0.5) * 4;
            
            // Scale heart up slightly
            x *= 1.5; y *= 1.5; z *= 1.5;
        } 
        else if (shapeType === 'saturn') {
            const isRing = Math.random() > 0.3; // 70% particles to ring
            if (isRing) {
                const theta = Math.random() * Math.PI * 2;
                const r = 25 + Math.random() * 15; // Ring width
                x = r * Math.cos(theta);
                y = (Math.random() - 0.5) * 2;
                z = r * Math.sin(theta);
            } else {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = 12; // Planet radius
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            }
        } 
        else if (shapeType === 'sphere') { // Looks like a dense firework core
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = Math.random() * 30; 
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta);
            z = r * Math.cos(phi);
        }
        else if (shapeType === 'lasandi') {
            if (textPoints.length > 0) {
                // Distribute particles across the text points
                const pt = textPoints[i % textPoints.length];
                x = pt.x + (Math.random() - 0.5) * 0.4;
                y = pt.y + (Math.random() - 0.5) * 0.4;
                z = (Math.random() - 0.5) * 1.5;
                
                // Scale text up a bit for better visibility
                x *= 2.0;
                y *= 2.0;
            } else {
                x = y = z = 0;
            }
        }

        targetPositions[i3] = x;
        targetPositions[i3 + 1] = y;
        targetPositions[i3 + 2] = z;
    }
}

// ==========================================
// 4. MEDIAPIPE HAND TRACKING
// ==========================================
const videoElement = document.getElementById('webcam');
let lastPinchTime = 0;

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Landmark 4 is Thumb Tip, 8 is Index Tip, 9 is Middle Knuckle (Palm center)
        const thumb = landmarks[4];
        const index = landmarks[8];
        const palm = landmarks[9];

        // Map palm position to rotate the 3D system
        const targetRotX = (palm.y - 0.5) * 4;
        const targetRotY = (palm.x - 0.5) * 4;
        particleSystem.rotation.x += (targetRotX - particleSystem.rotation.x) * 0.1;
        particleSystem.rotation.y += (targetRotY - particleSystem.rotation.y) * 0.1;

        // Calculate pinch distance
        const dx = thumb.x - index.x;
        const dy = thumb.y - index.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Gesture Logic
        if (distance < 0.05) {
            // Pinch detected: Shrink
            particleSystem.scale.lerp(new THREE.Vector3(0.3, 0.3, 0.3), 0.1);
            
            // Change shape (with 1.5s cooldown to prevent flickering)
            const now = Date.now();
            if (now - lastPinchTime > 1500) {
                currentShapeIndex = (currentShapeIndex + 1) % shapes.length;
                generateShape(shapes[currentShapeIndex]);
                lastPinchTime = now;
            }
        } else {
            // Hand open: Scale dynamically based on how wide fingers are spread
            const dynamicScale = 1 + (distance * 1.5);
            particleSystem.scale.lerp(new THREE.Vector3(dynamicScale, dynamicScale, dynamicScale), 0.1);
        }
    } else {
        // Default rotation when no hands are detected
        particleSystem.rotation.y += 0.002;
        particleSystem.rotation.x += 0.001;
        particleSystem.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
    }
});

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});
cameraUtils.start();

// ==========================================
// 5. ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    const positionsAttribute = geometry.attributes.position;
    const currentPositions = positionsAttribute.array;

    // Linear Interpolation (Lerp) for smooth morphing
    for (let i = 0; i < currentPositions.length; i++) {
        currentPositions[i] += (targetPositions[i] - currentPositions[i]) * 0.04;
    }
    
    positionsAttribute.needsUpdate = true;
    renderer.render(scene, camera);
}

// Start with the first shape and launch loop
generateShape(shapes[0]);
animate();

// Handle window resizing
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});