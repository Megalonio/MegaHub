// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const videoInput = document.getElementById('videoInput');
const uploadContainer = document.getElementById('uploadContainer');
const videoSection = document.getElementById('videoSection');
const videoPlayer = document.getElementById('videoPlayer');
const animationPreview = document.getElementById('animationPreview');
const loadingOverlay = document.getElementById('loadingOverlay');
const resetSpriteBtn = document.getElementById('resetSpriteBtn');
const previewBtn = document.getElementById('previewBtn');
const generateSpriteBtn = document.getElementById('generateSpriteBtn');
const spriteGrid = document.getElementById('spriteGrid');
const navHint = document.getElementById('navHint');
const previewHint = document.getElementById('previewHint');
const fpsDisplay = document.getElementById('fpsDisplay');
const frameCounter = document.getElementById('frameCounter');

// ─── Audio System ──────────────────────────────────────────────────────────
const SFX = {
    cursor:  new Audio('audio/menucursor.wav'),
    select:  new Audio('audio/menuselect.wav'),
    back:    new Audio('audio/menuback.wav'),
    chord:   new Audio('audio/menuchord.wav'),
};
// Allow rapid re-triggering by cloning on each play
function playSfx(name) {
    const snd = SFX[name];
    if (!snd) return;
    const clone = snd.cloneNode();
    clone.volume = snd.volume;
    clone.play().catch(() => {});
}

// State
let spriteSheetFrames = []; 
let impactFrameIndex = -1; 
let isPreviewing = false;
let previewInterval = null;
const VIDEO_NAV_STEP = 1 / 24; 

// Range capture state
let rangeStartTime = null;
let rangeStartIndex = null;
let rangeModeIndicator = null;

// Persistent FPS State
let currentPreviewFps = parseInt(localStorage.getItem('preferredFps')) || 12;

// Drag & Drop Enhancement
uploadZone.addEventListener('click', () => videoInput.click());

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop zone when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
    uploadZone.addEventListener(eventName, () => {
        uploadZone.classList.add('dragover');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, () => {
        uploadZone.classList.remove('dragover');
    }, false);
});

// Handle dropped files
uploadZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        loadVideo(files[0]);
    }
});

videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadVideo(file);
});

function loadVideo(file) {
    // Animated loading messages
    const loadingText = document.querySelector('.loading-text');
    const loadingSubtext = document.querySelector('.loading-subtext');
    
    const messages = [
        { main: 'INITIALIZING', sub: 'Preparing video stream...' },
        { main: 'LOADING', sub: 'Analyzing video data...' },
        { main: 'PROCESSING', sub: 'Building frame buffer...' }
    ];
    
    let msgIndex = 0;
    const msgInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % messages.length;
        loadingText.textContent = messages[msgIndex].main;
        loadingSubtext.textContent = messages[msgIndex].sub;
    }, 500);
    
    loadingOverlay.classList.add('active');
    videoPlayer.src = URL.createObjectURL(file);
    
    videoPlayer.addEventListener('loadedmetadata', () => {
        clearInterval(msgInterval);
        
        // Smooth transition
        setTimeout(() => {
            uploadContainer.style.display = 'none';
            videoSection.style.display = 'block';
            resetInternalState();
            
            setTimeout(() => {
                loadingOverlay.classList.remove('active');
            }, 300);
        }, 600);
    }, { once: true });
}

resetSpriteBtn.addEventListener('click', () => {
    if (spriteSheetFrames.length > 0) {
        // Confirmation feel
        if (!confirm('Clear all frames? This cannot be undone.')) return;
    }
    playSfx('back');
    
    videoPlayer.src = "";
    spriteSheetFrames = [];
    impactFrameIndex = -1;
    rangeStartTime = null;
    rangeStartIndex = null;
    hideRangeModeIndicator();
    stopPreview();
    
    // Smooth transition back
    videoSection.style.opacity = '0';
    setTimeout(() => {
        uploadContainer.style.display = 'flex';
        videoSection.style.display = 'none';
        videoSection.style.opacity = '1';
    }, 300);
    
    videoInput.value = ""; 
});

function getOrderedFrames() {
    if (impactFrameIndex === -1 || impactFrameIndex >= spriteSheetFrames.length) return spriteSheetFrames;
    return [...spriteSheetFrames.slice(impactFrameIndex), ...spriteSheetFrames.slice(0, impactFrameIndex)];
}

// Preview Logic with enhanced transitions
previewBtn.addEventListener('click', () => {
    if (isPreviewing) { playSfx('back'); stopPreview(); }
    else { playSfx('select'); startPreview(); }
});

function startPreview() {
    isPreviewing = true;
    previewBtn.innerHTML = '<span class="btn-icon">◼</span> Back to Video';
    
    // Smooth crossfade
    videoPlayer.style.opacity = '0';
    setTimeout(() => {
        videoPlayer.style.display = "none";
        animationPreview.style.display = "block";
        animationPreview.style.opacity = '0';
        
        setTimeout(() => {
            animationPreview.style.opacity = '1';
        }, 50);
    }, 200);
    
    navHint.style.display = "none";
    previewHint.style.display = "block";
    updateFpsDisplay();
    runAnimationLoop();
}

function runAnimationLoop() {
    clearInterval(previewInterval);
    const ordered = getOrderedFrames();
    let currentIdx = 0;
    const ctx = animationPreview.getContext('2d');
    animationPreview.width = videoPlayer.videoWidth;
    animationPreview.height = videoPlayer.videoHeight;

    // In the ordered array, index 0 is always the impact frame (if set)
    const impactIdxInLoop = (impactFrameIndex !== -1) ? 0 : -1;

    previewInterval = setInterval(() => {
        ctx.drawImage(ordered[currentIdx].canvas, 0, 0);
        if (currentIdx === impactIdxInLoop) {
            playSfx('select');
        }
        currentIdx = (currentIdx + 1) % ordered.length;
    }, 1000 / currentPreviewFps);
}

function stopPreview() {
    isPreviewing = false;
    previewBtn.innerHTML = '<span class="btn-icon">▶</span> Preview Animation';
    clearInterval(previewInterval);
    
    // Smooth crossfade back
    animationPreview.style.opacity = '0';
    setTimeout(() => {
        animationPreview.style.display = "none";
        videoPlayer.style.display = "block";
        videoPlayer.style.opacity = '0';
        
        setTimeout(() => {
            videoPlayer.style.opacity = '1';
        }, 50);
    }, 200);
    
    navHint.style.display = "block";
    previewHint.style.display = "none";
}

function updateFpsDisplay() {
    fpsDisplay.textContent = `${currentPreviewFps} FPS`;
    localStorage.setItem('preferredFps', currentPreviewFps);
    
    // Pulse effect on change
    fpsDisplay.style.transform = 'scale(1.2)';
    fpsDisplay.style.color = 'var(--accent-pink)';
    setTimeout(() => {
        fpsDisplay.style.transform = 'scale(1)';
        fpsDisplay.style.color = 'var(--accent-cyan)';
    }, 150);
}

// Global Controls
function showNavArrow(direction) {
    const arrow = direction === 'left' ? 
        document.getElementById('navArrowLeft') : 
        document.getElementById('navArrowRight');
    
    arrow.classList.remove('show');
    void arrow.offsetWidth; // Trigger reflow
    arrow.classList.add('show');
    
    setTimeout(() => {
        arrow.classList.remove('show');
    }, 400);
}

function showRangeModeIndicator() {
    if (!rangeModeIndicator) {
        rangeModeIndicator = document.createElement('div');
        rangeModeIndicator.className = 'range-mode-indicator';
        document.body.appendChild(rangeModeIndicator);
    }
    
    const frameCount = spriteSheetFrames.length - rangeStartIndex;
    rangeModeIndicator.innerHTML = `
        ◉ RANGE MODE ACTIVE
        <span class="range-count">${frameCount} frame${frameCount !== 1 ? 's' : ''} selected</span>
    `;
    rangeModeIndicator.style.display = 'block';
}

function hideRangeModeIndicator() {
    if (rangeModeIndicator) {
        rangeModeIndicator.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => {
            rangeModeIndicator.style.display = 'none';
            rangeModeIndicator.style.animation = '';
        }, 200);
    }
}

document.addEventListener('keydown', (e) => {
    if (!videoPlayer.src) return;

    if (isPreviewing) {
        // FPS Controls during preview
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            currentPreviewFps = Math.max(1, currentPreviewFps - 1);
            playSfx('cursor');
            updateFpsDisplay();
            runAnimationLoop();
            showNavArrow('left');
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            currentPreviewFps = Math.min(60, currentPreviewFps + 1);
            playSfx('cursor');
            updateFpsDisplay();
            runAnimationLoop();
            showNavArrow('right');
        }
        return;
    }
    
    // Video controls
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - VIDEO_NAV_STEP);
        playSfx('cursor');
        showNavArrow('left');
    }
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + VIDEO_NAV_STEP);
        playSfx('cursor');
        showNavArrow('right');
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        
        // ArrowDown starts/ends range capture
        if (e.key === 'ArrowDown') {
            if (rangeStartTime === null) {
                // Start range capture
                rangeStartTime = videoPlayer.currentTime;
                rangeStartIndex = spriteSheetFrames.length;
                playSfx('select');
                captureCurrentFrame();
                showRangeModeIndicator();
            } else {
                // End range capture - capture all frames in between
                const endTime = videoPlayer.currentTime;
                const startTime = rangeStartTime;
                playSfx('select');
                
                if (endTime > startTime) {
                    captureRangeFrames(startTime, endTime);
                } else {
                    // If went backwards, just capture current frame
                    captureCurrentFrame();
                }
                
                // Reset range mode
                rangeStartTime = null;
                rangeStartIndex = null;
                setTimeout(() => hideRangeModeIndicator(), 300);
            }
        } else {
            // ArrowUp or Enter - single frame capture (old behavior)
            playSfx('select');
            captureCurrentFrame();
        }
    }
});

function captureCurrentFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = videoPlayer.videoWidth;
    canvas.height = videoPlayer.videoHeight;
    canvas.getContext('2d').drawImage(videoPlayer, 0, 0);
    spriteSheetFrames.push({ canvas });
    
    // Haptic-like feedback
    videoPlayer.style.transform = 'scale(0.98)';
    setTimeout(() => {
        videoPlayer.style.transform = 'scale(1)';
    }, 100);
    
    rebuildSpriteGrid();
    updateUI();
    
    // Auto-scroll to newest frame
    setTimeout(() => {
        const container = document.querySelector('.sprite-grid-container');
        container.scrollLeft = container.scrollWidth;
    }, 50);
}

async function captureRangeFrames(startTime, endTime) {
    const timeDiff = endTime - startTime;
    const framesToCapture = Math.ceil(timeDiff * 24); // 24 fps
    
    // Show loading feedback
    const loadingText = document.querySelector('.loading-text');
    const loadingSubtext = document.querySelector('.loading-subtext');
    loadingText.textContent = 'CAPTURING';
    loadingSubtext.textContent = `Extracting ${framesToCapture} frames...`;
    loadingOverlay.classList.add('active');
    
    const originalTime = videoPlayer.currentTime;
    
    // Capture each frame
    for (let i = 1; i <= framesToCapture; i++) {
        const frameTime = startTime + (i * timeDiff / framesToCapture);
        
        // Seek to frame
        videoPlayer.currentTime = frameTime;
        
        // Wait for seek to complete
        await new Promise(resolve => {
            const onSeeked = () => {
                videoPlayer.removeEventListener('seeked', onSeeked);
                resolve();
            };
            videoPlayer.addEventListener('seeked', onSeeked);
        });
        
        // Small delay to ensure frame is ready
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Capture the frame
        const canvas = document.createElement('canvas');
        canvas.width = videoPlayer.videoWidth;
        canvas.height = videoPlayer.videoHeight;
        canvas.getContext('2d').drawImage(videoPlayer, 0, 0);
        spriteSheetFrames.push({ canvas });
        
        // Update UI periodically
        if (i % 5 === 0 || i === framesToCapture) {
            loadingSubtext.textContent = `Captured ${i}/${framesToCapture} frames...`;
            rebuildSpriteGrid();
            updateUI();
        }
    }
    
    // Final UI update
    rebuildSpriteGrid();
    updateUI();
    
    // Auto-scroll to newest frames
    setTimeout(() => {
        const container = document.querySelector('.sprite-grid-container');
        container.scrollLeft = container.scrollWidth;
    }, 50);
    
    // Return to original time
    videoPlayer.currentTime = originalTime;
    
    // Hide loading
    loadingText.textContent = 'COMPLETE';
    loadingSubtext.textContent = `${framesToCapture} frames captured!`;
    setTimeout(() => {
        loadingOverlay.classList.remove('active');
    }, 600);
}

function rebuildSpriteGrid() {
    // Clear grid but keep empty state if needed
    if (spriteSheetFrames.length === 0) {
        spriteGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">◇</div>
                <div class="empty-text">No frames yet</div>
                <div class="empty-hint">Capture frames from the video above</div>
            </div>
        `;
        return;
    }
    
    spriteGrid.innerHTML = '';
    spriteSheetFrames.forEach((frameObj, index) => {
        const slot = document.createElement('div');
        slot.className = `sprite-slot filled ${index === impactFrameIndex ? 'impact-frame' : ''}`;
        
        // Delete button
        const del = document.createElement('div');
        del.className = 'delete-btn'; 
        del.innerHTML = '&times;';
        del.title = 'Delete frame';
        del.onclick = (e) => {
            e.stopPropagation();
            
            // Animate out
            slot.style.animation = 'none';
            slot.style.transform = 'scale(0.8)';
            slot.style.opacity = '0';
            
            setTimeout(() => {
                spriteSheetFrames.splice(index, 1);
                if (impactFrameIndex === index) impactFrameIndex = -1;
                else if (impactFrameIndex > index) impactFrameIndex--;
                rebuildSpriteGrid();
                updateUI();
            }, 200);
        };

        // Frame number badge
        const badge = document.createElement('div');
        badge.className = 'sprite-slot-number';
        badge.textContent = index + 1;

        // Display canvas
        const displayCanvas = document.createElement('canvas');
        displayCanvas.width = frameObj.canvas.width;
        displayCanvas.height = frameObj.canvas.height;
        displayCanvas.getContext('2d').drawImage(frameObj.canvas, 0, 0);
        
        // Click to set impact frame
        slot.onclick = () => { 
            impactFrameIndex = index; 
            rebuildSpriteGrid();
            
            // Scroll to impact frame
            setTimeout(() => {
                slot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }, 50);
        };
        
        slot.appendChild(del); 
        slot.appendChild(badge);
        slot.appendChild(displayCanvas);
        spriteGrid.appendChild(slot);
        
        // Stagger animation
        slot.style.animationDelay = `${index * 0.05}s`;
    });
}

function updateUI() {
    const hasFrames = spriteSheetFrames.length > 0;
    const isSingle = spriteSheetFrames.length === 1;
    generateSpriteBtn.disabled = !hasFrames;
    previewBtn.disabled = !hasFrames;
    
    // Update generate button label
    if (isSingle) {
        generateSpriteBtn.innerHTML = '<span class="btn-icon">↓</span> Save Screenshot';
    } else {
        generateSpriteBtn.innerHTML = '<span class="btn-icon">↓</span> Generate PNG';
    }
    
    // Update frame counter with animation
    const newCount = `${spriteSheetFrames.length} frame${spriteSheetFrames.length !== 1 ? 's' : ''}`;
    if (frameCounter.textContent !== newCount) {
        frameCounter.style.transform = 'scale(1.2)';
        frameCounter.textContent = newCount;
        
        // Add badge style if has frames
        if (hasFrames) {
            frameCounter.classList.add('has-frames');
        } else {
            frameCounter.classList.remove('has-frames');
        }
        
        setTimeout(() => {
            frameCounter.style.transform = 'scale(1)';
        }, 150);
    }
}

function resetInternalState() {
    spriteSheetFrames = []; 
    impactFrameIndex = -1;
    stopPreview(); 
    rebuildSpriteGrid(); 
    updateUI();
}

function generateSpriteSheet() {
    // Show loading briefly
    const loadingText = document.querySelector('.loading-text');
    const loadingSubtext = document.querySelector('.loading-subtext');
    loadingOverlay.classList.add('active');
    
    const ordered = getOrderedFrames();
    const isSingle = ordered.length === 1;
    
    if (isSingle) {
        loadingText.textContent = 'EXPORTING';
        loadingSubtext.textContent = 'Saving screenshot...';
    } else {
        loadingText.textContent = 'GENERATING';
        loadingSubtext.textContent = 'Creating sprite sheet...';
    }
    
    setTimeout(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fw = ordered[0].canvas.width;
        const fh = ordered[0].canvas.height;
        
        if (isSingle) {
            // Pure single screenshot — no sheet
            canvas.width = fw;
            canvas.height = fh;
            ctx.drawImage(ordered[0].canvas, 0, 0);
        } else {
            // Sprite sheet: max 5 per row, each new row after every 5 frames
            const cols = Math.min(5, ordered.length);
            const rows = Math.ceil(ordered.length / 5);
            canvas.width = fw * cols;
            canvas.height = fh * rows;

            ordered.forEach((f, i) => {
                const col = i % 5;
                const row = Math.floor(i / 5);
                ctx.drawImage(f.canvas, col * fw, row * fh);
            });
        }

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            if (isSingle) {
                link.download = `screenshot_frame.png`;
            } else {
                link.download = `spritesheet_${ordered.length}frames_${currentPreviewFps}fps.png`;
            }
            link.href = url;
            link.click();
            playSfx('chord');
            
            // Cleanup
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            // Success feedback
            loadingText.textContent = 'SUCCESS';
            loadingSubtext.textContent = isSingle ? 'Screenshot downloaded!' : 'Sprite sheet downloaded!';
            
            setTimeout(() => {
                loadingOverlay.classList.remove('active');
            }, 800);
        }, 'image/png');
    }, 300);
}

generateSpriteBtn.addEventListener('click', generateSpriteSheet);

// Add smooth transitions to video and preview
videoPlayer.style.transition = 'opacity 0.3s ease, transform 0.1s ease';
animationPreview.style.transition = 'opacity 0.3s ease';

// Initialize
updateUI();