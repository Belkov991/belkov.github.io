        // script.js
        document.addEventListener('DOMContentLoaded', () => {
            const TRACKS = new Map();
            let audioContext = null;
            let globalStartTime = 0;
            let isPlaying = false;
            const BUFFER_CACHE = new Map();

            async function initAudioSystem() {
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    await loadAllAudioBuffers();
                    initTracks();
                } catch (error) {
                    console.error('音频系统初始化失败:', error);
                    alert('音频初始化失败，请刷新页面重试');
                }
            }

            async function loadAllAudioBuffers() {
                const audioUrls = [...document.querySelectorAll('.music-avatar')]
                    .map(img => img.dataset.audio);
                
                await Promise.all(audioUrls.map(async url => {
                    if (!BUFFER_CACHE.has(url)) {
                        const buffer = await fetch(url)
                            .then(res => res.arrayBuffer())
                            .then(buf => audioContext.decodeAudioData(buf));
                        BUFFER_CACHE.set(url, buffer);
                    }
                }));
            }

            function initTracks() {
                document.querySelectorAll('.music-avatar').forEach(avatar => {
                    const track = {
                        source: null,
                        gainNode: audioContext.createGain(),
                        panNode: audioContext.createStereoPanner(),
                        isActive: false,
                        volume: parseFloat(localStorage.getItem(avatar.dataset.audio)) || 0.2,
                        loopStart: 0,
                        loopEnd: BUFFER_CACHE.get(avatar.dataset.audio).duration,
                        get buffer() {
                            return BUFFER_CACHE.get(avatar.dataset.audio);
                        }
                    };

                    track.gainNode.connect(track.panNode);
                    track.panNode.connect(audioContext.destination);
                    track.gainNode.gain.value = track.volume;

                    TRACKS.set(avatar, track);
                    initDOMEvents(avatar);
                });
            }

            function initDOMEvents(avatar) {
                const slider = avatar.parentElement.nextElementSibling;
                avatar.style.setProperty('--current-scale', 0.8);

                avatar.addEventListener('click', () => {
                    const track = TRACKS.get(avatar);
                    track.isActive = !track.isActive;

                    if (track.isActive) {
                        activateTrack(avatar);
                    } else {
                        deactivateTrack(avatar);
                    }

                    updatePlaybackState();
                });

                slider.addEventListener('input', e => {
                    const volume = e.target.value / 100;
                    const track = TRACKS.get(avatar);
                    track.volume = volume;
                    track.gainNode.gain.setTargetAtTime(
                        volume, 
                        audioContext.currentTime, 
                        0.01
                    );
                    localStorage.setItem(avatar.dataset.audio, volume);
                    updateVisuals(avatar, volume);
                });
            }

            function activateTrack(avatar) {
                const track = TRACKS.get(avatar);
                if (!track.source) {
                    track.source = audioContext.createBufferSource();
                    track.source.buffer = track.buffer;
                    track.source.connect(track.gainNode);
                    track.source.loop = true;
                }

                const now = audioContext.currentTime;
                if (!isPlaying) {
                    globalStartTime = now;
                    isPlaying = true;
                }

                avatar.classList.add('rotating');
                track.source.start(now, (now - globalStartTime) % track.buffer.duration);
                track.gainNode.gain.value = track.volume;
                avatar.src = avatar.dataset.imgActive;
                avatar.parentElement.nextElementSibling.style.display = 'block';
                updateVisuals(avatar, track.volume);
            }

            function deactivateTrack(avatar) {
                const track = TRACKS.get(avatar);
                avatar.classList.remove('rotating');
                track.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                avatar.src = avatar.dataset.imgNormal;
                avatar.parentElement.nextElementSibling.style.display = 'none';

                setTimeout(() => {
                    if (track.source) {
                        track.source.stop();
                        track.source.disconnect();
                        track.source = null;
                    }
                }, 1000);
            }

            function updatePlaybackState() {
                const activeTracks = [...TRACKS.values()].filter(t => t.isActive);
                if (activeTracks.length === 0) {
                    isPlaying = false;
                    globalStartTime = 0;
                }
            }

            function updateVisuals(avatar, volume) {
                const scale = 0.8 + (volume * 0.4);
                avatar.style.setProperty('--current-scale', scale);
                avatar.style.opacity = 0.5 + (volume * 0.5);
                
                // 强制重绘动画保持流畅
                if(avatar.classList.contains('rotating')) {
                    avatar.style.animation = 'none';
                    void avatar.offsetWidth;
                    avatar.style.animation = '';
                }
            }

            // 自动恢复音频上下文
            document.addEventListener('click', () => {
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume();
                }
            }, { once: true });

            initAudioSystem();
        });