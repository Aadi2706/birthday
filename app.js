/* ==========================================
   INTERACTIVE BIRTHDAY WISH BUILDER - APP LOGIC
   ========================================== */

(function () {
    // State storage
    const state = {
        theme: 'theme-mystic-night',
        // Raw filenames for the background images (will be automatically resolved relative to index.html)
        images: ['image-copy-3.png', 'image-copy-4.png', 'image-copy-5.png', 'image-copy-6.png'],
        activeSlide: 0,
        slideshowInterval: null,
        bgCanvas: null,
        bgCtx: null,
        confettiCanvas: null,
        confettiCtx: null,
        activeParticles: [],
        activeConfetti: [],
        canvasWidth: 0,
        canvasHeight: 0,
        
        // Active viewer wish configuration
        wishData: null,
        
        // Audio synthesis configuration
        audioCtx: null,
        musicNode: null,
        isPlayingMusic: false,

        // Carousel State
        carousel: {
            currentIndex: 0,
            autoplayInterval: null,
            touchStartX: 0,
            touchEndX: 0
        },
        
        // Active Games states
        games: {
            cake: {
                canvas: null,
                ctx: null,
                candles: [],
                allBlown: false
            },
            scratch: {
                canvas: null,
                ctx: null,
                isDrawing: false,
                percentScratched: 0,
                isComplete: false
            },
            balloon: {
                canvas: null,
                ctx: null,
                score: 0,
                timeLeft: 15,
                balloons: [],
                gameInterval: null,
                timerInterval: null,
                isActive: false
            }
        }
    };

    // --- UTILITIES: URL ENCODING & PARSING ---
    function encodeWishData(data) {
        try {
            const jsonStr = JSON.stringify(data);
            // Handle unicode safety before base64
            const utf8Bytes = new TextEncoder().encode(jsonStr);
            let binary = '';
            for (let i = 0; i < utf8Bytes.length; i++) {
                binary += String.fromCharCode(utf8Bytes[i]);
            }
            return btoa(binary)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        } catch (e) {
            console.error("Encoding error", e);
            return '';
        }
    }

    function decodeWishData(str) {
        try {
            // Restore Base64 padding and standard chars
            let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) {
                base64 += '=';
            }
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const jsonStr = new TextDecoder().decode(bytes);
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("Decoding error", e);
            return null;
        }
    }

    // --- DOM READY INITIALIZATION ---
    document.addEventListener("DOMContentLoaded", () => {
        initBackgroundSlideshow();
        checkRouting();
        initBuilderWizard();
        initViewerControls();
        initWindowResize();
    });

    // --- ROUTING / SCREEN CHECK ---
    function checkRouting() {
        const urlParams = new URLSearchParams(window.location.search);
        const wishParam = urlParams.get('wish');

        if (wishParam) {
            const decoded = decodeWishData(wishParam);
            if (decoded) {
                state.wishData = decoded;
                setupViewerMode(decoded);
                return;
            }
        }
        
        // Default: Show Builder Mode
        document.getElementById("builder-container").classList.remove("hidden");
        setGlobalTheme('theme-mystic-night');
        initCanvases();
        startBackgroundEffects();
    }

    // --- BACKGROUND SLIDESHOW (Smooth Crossfades) ---
    function initBackgroundSlideshow() {
        const slideshowContainer = document.getElementById("background-slideshow");
        if (!slideshowContainer) return;

        // Clear contents
        slideshowContainer.innerHTML = '';

        // Inject slide elements
        state.images.forEach((imgSrc, index) => {
            const slide = document.createElement("div");
            slide.className = `background-slide ${index === 0 ? 'active' : ''}`;
            // Use encodeURI for spaces in filenames safely
            slide.style.backgroundImage = `url('${encodeURI(imgSrc)}')`;
            slideshowContainer.appendChild(slide);
        });

        // Loop slideshow
        clearInterval(state.slideshowInterval);
        state.slideshowInterval = setInterval(() => {
            const slides = slideshowContainer.querySelectorAll(".background-slide");
            if (slides.length < 2) return;

            slides[state.activeSlide].classList.remove("active");
            state.activeSlide = (state.activeSlide + 1) % slides.length;
            slides[state.activeSlide].classList.add("active");
        }, 6500);
    }

    // --- GLOBAL THEME SYSTEM ---
    function setGlobalTheme(themeName) {
        state.theme = themeName;
        document.body.className = themeName;
        
        // Redraw canvas particles for current theme if canvases exist
        if (state.bgCtx) {
            initThemeParticles();
        }
    }

    // --- BUILDER WIZARD CONTROLLER ---
    function initBuilderWizard() {
        const stepSections = document.querySelectorAll(".wizard-step");
        const stepIndicators = document.querySelectorAll(".step-indicator");
        const progressBar = document.getElementById("progress-bar");

        function goToStep(stepNum) {
            // Hide all steps
            stepSections.forEach(step => step.classList.remove("active"));
            stepIndicators.forEach(ind => {
                const stepIdx = parseInt(ind.getAttribute("data-step"));
                if (stepIdx < stepNum) {
                    ind.className = "step-indicator completed";
                } else if (stepIdx === stepNum) {
                    ind.className = "step-indicator active";
                } else {
                    ind.className = "step-indicator";
                }
            });

            // Show current step
            const currentStepEl = document.getElementById(`step-${stepNum}`);
            if (currentStepEl) {
                currentStepEl.classList.add("active");
            }

            // Update progress bar
            const percent = ((stepNum - 1) / (stepSections.length - 1)) * 100;
            progressBar.style.width = `${percent}%`;
        }

        // Hook up Next Buttons
        document.querySelectorAll(".btn-next").forEach(btn => {
            btn.addEventListener("click", () => {
                const nextStep = parseInt(btn.getAttribute("data-next"));
                
                // Perform quick validations for step 1
                if (nextStep === 2) {
                    const nameInput = document.getElementById("star-name");
                    if (!nameInput.value.trim()) {
                        nameInput.focus();
                        nameInput.style.borderColor = "red";
                        setTimeout(() => nameInput.style.borderColor = '', 2000);
                        return;
                    }
                }
                
                goToStep(nextStep);
            });
        });

        // Hook up Prev Buttons
        document.querySelectorAll(".btn-prev").forEach(btn => {
            btn.addEventListener("click", () => {
                const prevStep = parseInt(btn.getAttribute("data-prev"));
                goToStep(prevStep);
            });
        });

        // Theme selection card clicks
        document.querySelectorAll(".theme-card").forEach(card => {
            card.addEventListener("click", () => {
                document.querySelectorAll(".theme-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                
                const themeChoice = card.querySelector("input").value;
                setGlobalTheme(themeChoice);
            });
        });

        // Template Letter Insertion
        document.querySelectorAll(".template-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const msgBox = document.getElementById("birthday-message");
                msgBox.value = btn.getAttribute("data-text");
                // Bounce transition simulation
                msgBox.style.transform = 'scale(0.98)';
                setTimeout(() => msgBox.style.transform = '', 150);
            });
        });

        // Generate Magical Link Action
        const btnGenerate = document.getElementById("btn-generate");
        if (btnGenerate) {
            btnGenerate.addEventListener("click", () => {
                const name = document.getElementById("star-name").value.trim();
                const relation = document.getElementById("star-relation").value;
                const age = document.getElementById("star-age").value;
                const activeThemeCard = document.querySelector(".theme-card.active input");
                const chosenTheme = activeThemeCard ? activeThemeCard.value : 'theme-mystic-night';
                const message = document.getElementById("birthday-message").value.trim() || 
                    "Wishing you a year filled with wonderful surprises, success, and pure joy!";

                // Gather 4 timeline memories
                const memories = [];
                document.querySelectorAll(".timeline-form-entry").forEach(entry => {
                    const year = entry.querySelector(".memory-year").value.trim();
                    const title = entry.querySelector(".memory-title").value.trim();
                    const desc = entry.querySelector(".memory-desc").value.trim();

                    // Even if empty, we insert default values so slides align
                    memories.push({ year, title, desc });
                });

                // Gather surprise gift rewards
                const giftCakeText = document.getElementById("gift-cake-text").value.trim();
                const giftScratchText = document.getElementById("gift-scratch-text").value.trim();
                const giftBalloonText = document.getElementById("gift-balloon-text").value.trim();

                const wishConfig = {
                    name,
                    relation,
                    age,
                    theme: chosenTheme,
                    message,
                    memories,
                    gifts: {
                        cake: giftCakeText || "May all your dreams come true! 🎂✨",
                        scratch: giftScratchText || "Coupon: Good for 1 warm hug! ♥",
                        balloon: giftBalloonText || "High score! Hope your year is epic! 🎈🏆"
                    }
                };

                const encodedString = encodeWishData(wishConfig);
                const finalUrl = `${window.location.origin}${window.location.pathname}?wish=${encodedString}`;

                // Pop Share Dialog
                const shareInput = document.getElementById("share-url-input");
                const previewLink = document.getElementById("preview-wish-link");
                
                shareInput.value = finalUrl;
                previewLink.href = finalUrl;

                document.getElementById("share-modal").classList.remove("hidden");
                triggerConfettiBurst(200, window.innerWidth / 2, window.innerHeight / 2);
                playChimeSound();
            });
        }

        // Close Share Modal
        const btnCloseShare = document.getElementById("btn-close-share");
        if (btnCloseShare) {
            btnCloseShare.addEventListener("click", () => {
                document.getElementById("share-modal").classList.add("hidden");
            });
        }

        // Copy Link Clipboard Action
        const btnCopyUrl = document.getElementById("btn-copy-url");
        const copyToast = document.getElementById("copy-toast");
        if (btnCopyUrl && copyToast) {
            btnCopyUrl.addEventListener("click", () => {
                const shareInput = document.getElementById("share-url-input");
                shareInput.select();
                shareInput.setSelectionRange(0, 99999); // Mobile compatibility
                navigator.clipboard.writeText(shareInput.value)
                    .then(() => {
                        copyToast.classList.remove("hidden");
                        btnCopyUrl.textContent = "Copied!";
                        setTimeout(() => {
                            copyToast.classList.add("hidden");
                            btnCopyUrl.textContent = "Copy Link";
                        }, 2500);
                    })
                    .catch(err => {
                        console.error('Clipboard copy failed', err);
                    });
            });
        }
    }

    // --- VIEWER MODE SETUP ---
    function setupViewerMode(data) {
        // Set styling immediately
        setGlobalTheme(data.theme);

        // Hide builder, show introductory envelope gate
        document.getElementById("builder-container").classList.add("hidden");
        document.getElementById("intro-gate").classList.remove("hidden");

        // Populate Viewer Texts
        const starGreeting = document.getElementById("viewer-greeting");
        let greetingText = `Happy Birthday, ${data.name}! ✨`;
        if (data.age) {
            greetingText = `Happy ${data.age}th Birthday, ${data.name}! 🎂`;
        }
        starGreeting.textContent = greetingText;

        const subtitleEl = document.getElementById("viewer-countdown-subtext");
        subtitleEl.textContent = `A magical birthday page made just for you by a special ${data.relation}! 🎉`;

        document.getElementById("viewer-message").textContent = data.message;
        document.getElementById("viewer-author-name").textContent = `Your ${data.relation}`;

        // Setup Envelope Card tease
        document.querySelector(".envelope-teaser").textContent = `A special message from your ${data.relation}...`;

        // Initialize Carousel Slides
        setupMemoryCarousel(data.memories);

        // Bind Envelope Open Action
        const envelope = document.getElementById("main-envelope");
        const btnOpen = document.getElementById("btn-open-envelope");
        
        const triggerOpen = () => {
            if (envelope.classList.contains("open")) return;
            envelope.classList.add("open");
            
            initAudioContext();
            playChimeSound();
            
            setTimeout(() => {
                const introGate = document.getElementById("intro-gate");
                introGate.classList.add("fade-out");
                
                setTimeout(() => {
                    introGate.classList.add("hidden");
                    // Enter viewer container
                    document.getElementById("viewer-container").classList.remove("hidden");
                    
                    // Init viewer assets
                    initCanvases();
                    startBackgroundEffects();
                    startMusicLoop();
                    
                    // Setup scroll animations & carousel autoplay
                    bindScrollAnimationTrigger();
                    startCarouselAutoplay();
                    
                    // Fire initial welcome confetti
                    triggerConfettiBurst(120, window.innerWidth / 2, window.innerHeight / 3);
                }, 1000);
            }, 1800);
        };

        btnOpen.addEventListener("click", (e) => {
            e.stopPropagation();
            triggerOpen();
        });
        envelope.addEventListener("click", triggerOpen);
    }

    // --- INTERACTIVE MEMORY CAROUSEL LOGIC ---
    function setupMemoryCarousel(userMemories) {
        const sectionTimeline = document.getElementById("section-timeline");
        const track = document.getElementById("viewer-carousel-track");
        const dotsContainer = document.getElementById("carousel-nav-dots");

        if (!track || !dotsContainer) return;
        track.innerHTML = '';
        dotsContainer.innerHTML = '';

        const defaultTitles = [
            "A Special Milestone 💫",
            "Unforgettable Laughs 😂",
            "Dreaming Together ✨",
            "To the Future & Beyond 🚀"
        ];
        const defaultDescriptions = [
            "One of the sweetest memories we share together.",
            "That inside joke that still makes us burst out laughing.",
            "A beautiful day where time stood completely still.",
            "Looking forward to creating many more chapters with you."
        ];

        // Ensure we always have exactly 4 slides matching the 4 background photos
        const slideCount = 4;
        let validSlidesExist = false;

        for (let i = 0; i < slideCount; i++) {
            const imgSrc = state.images[i];
            const mem = (userMemories && userMemories[i]) ? userMemories[i] : null;

            // Extract values, fallback to defaults if blank
            const year = (mem && mem.year) ? mem.year : '';
            const title = (mem && mem.title) ? mem.title : defaultTitles[i];
            const desc = (mem && mem.desc) ? mem.desc : defaultDescriptions[i];

            if (mem && (mem.year || mem.title || mem.desc)) {
                validSlidesExist = true; // User customized at least one field
            }

            // Create Slide element
            const slide = document.createElement("div");
            slide.className = `carousel-slide ${i === 0 ? 'active' : ''}`;
            
            // Image
            const img = document.createElement("img");
            img.src = imgSrc;
            img.className = "carousel-image";
            img.alt = title;
            slide.appendChild(img);

            // Caption overlay
            const caption = document.createElement("div");
            caption.className = "carousel-caption";
            
            let captionHTML = '';
            if (year) {
                captionHTML += `<span class="carousel-year-badge">${year}</span>`;
            }
            captionHTML += `<h3>${title}</h3>`;
            captionHTML += `<p>${desc}</p>`;
            caption.innerHTML = captionHTML;
            slide.appendChild(caption);

            track.appendChild(slide);

            // Create Dot indicator
            const dot = document.createElement("button");
            dot.className = `carousel-indicator ${i === 0 ? 'active' : ''}`;
            dot.setAttribute("data-slide", i);
            dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
            dotsContainer.appendChild(dot);
        }

        // Show the timeline carousel section if any slide has customizations (or display always as beautiful photo viewer)
        sectionTimeline.classList.remove("hidden");

        // Bind Carousel Arrow Controls
        const btnLeft = document.getElementById("carousel-btn-left");
        const btnRight = document.getElementById("carousel-btn-right");

        if (btnLeft && btnRight) {
            btnLeft.onclick = () => {
                stopCarouselAutoplay();
                navigateCarousel('prev');
            };
            btnRight.onclick = () => {
                stopCarouselAutoplay();
                navigateCarousel('next');
            };
        }

        // Bind Dot indicators click
        dotsContainer.addEventListener("click", (e) => {
            if (e.target.classList.contains("carousel-indicator")) {
                stopCarouselAutoplay();
                const targetIdx = parseInt(e.target.getAttribute("data-slide"));
                moveToSlide(targetIdx);
            }
        });

        // Swipe support for touch screens
        track.addEventListener("touchstart", (e) => {
            state.carousel.touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        track.addEventListener("touchend", (e) => {
            state.carousel.touchEndX = e.changedTouches[0].screenX;
            handleCarouselSwipe();
        }, { passive: true });
    }

    function moveToSlide(index) {
        const track = document.getElementById("viewer-carousel-track");
        const slides = track.querySelectorAll(".carousel-slide");
        const dots = document.querySelectorAll(".carousel-indicator");

        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;

        state.carousel.currentIndex = index;

        // Slide the track
        track.style.transform = `translateX(-${index * 100}%)`;

        // Update active class on slides for Ken Burns trigger
        slides.forEach((slide, idx) => {
            if (idx === index) {
                slide.classList.add("active");
            } else {
                slide.classList.remove("active");
            }
        });

        // Update active dots
        dots.forEach((dot, idx) => {
            if (idx === index) {
                dot.classList.add("active");
            } else {
                dot.classList.remove("active");
            }
        });
    }

    function navigateCarousel(direction) {
        const nextIdx = direction === 'next' ? state.carousel.currentIndex + 1 : state.carousel.currentIndex - 1;
        moveToSlide(nextIdx);
    }

    function startCarouselAutoplay() {
        clearInterval(state.carousel.autoplayInterval);
        state.carousel.autoplayInterval = setInterval(() => {
            navigateCarousel('next');
        }, 6000);
    }

    function stopCarouselAutoplay() {
        clearInterval(state.carousel.autoplayInterval);
    }

    function handleCarouselSwipe() {
        const deltaX = state.carousel.touchEndX - state.carousel.touchStartX;
        if (deltaX < -50) { // Swiped left
            stopCarouselAutoplay();
            navigateCarousel('next');
        } else if (deltaX > 50) { // Swiped right
            stopCarouselAutoplay();
            navigateCarousel('prev');
        }
    }

    // --- SCROLL ANIMATION TRIGGER ENGINE ---
    function bindScrollAnimationTrigger() {
        const scrollElements = document.querySelectorAll(".animate-on-scroll");

        const elementInViewport = (el, dividend = 1.15) => {
            const elementTop = el.getBoundingClientRect().top;
            return (elementTop <= (window.innerHeight || document.documentElement.clientHeight) / dividend);
        };

        const displayScrollElement = (element) => {
            element.classList.add("visible");
        };

        const handleScrollAnimation = () => {
            scrollElements.forEach((el) => {
                if (elementInViewport(el)) {
                    displayScrollElement(el);
                }
            });
        };

        window.addEventListener("scroll", handleScrollAnimation);
        handleScrollAnimation();
    }

    // --- VIEWER SIDEBAR CONTROLS ---
    function initViewerControls() {
        const btnConfetti = document.getElementById("btn-viewer-confetti");
        if (btnConfetti) {
            btnConfetti.addEventListener("click", (e) => {
                triggerConfettiBurst(80, e.clientX, e.clientY);
                playChimeSound();
            });
        }

        // Music toggle action
        const btnMusic = document.getElementById("btn-music-toggle");
        const slashBar = document.getElementById("music-slash-bar");
        if (btnMusic) {
            btnMusic.addEventListener("click", () => {
                if (!state.audioCtx) {
                    initAudioContext();
                }

                if (state.isPlayingMusic) {
                    stopMusicLoop();
                    slashBar.classList.remove("hidden");
                } else {
                    startMusicLoop();
                    slashBar.classList.add("hidden");
                }
            });
        }

        // Interactive Gift Boxes Openers
        document.querySelectorAll(".btn-open-gift").forEach(btn => {
            btn.addEventListener("click", () => {
                const giftType = btn.getAttribute("data-gift");
                openGiftGame(giftType, btn.closest(".gift-box-card"));
            });
        });

        // Close Game Screen Modal
        const btnCloseGame = document.getElementById("btn-close-game");
        if (btnCloseGame) {
            btnCloseGame.addEventListener("click", () => {
                closeGameModal();
            });
        }
    }

    // --- DYNAMIC AUDIO SYNTHESIS ENGINE (Web Audio API) ---
    function initAudioContext() {
        if (state.audioCtx) return;
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Play procedural chime
    function playChimeSound() {
        if (!state.audioCtx) return;
        const now = state.audioCtx.currentTime;
        
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 pentatonic
        notes.forEach((freq, idx) => {
            const osc = state.audioCtx.createOscillator();
            const gain = state.audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            
            gain.gain.setValueAtTime(0.12, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);
            
            osc.connect(gain);
            gain.connect(state.audioCtx.destination);
            
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.6);
        });
    }

    // Procedural sound effects
    function playSfx(type) {
        if (!state.audioCtx) return;
        const now = state.audioCtx.currentTime;
        
        if (type === 'blow') {
            const bufferSize = state.audioCtx.sampleRate * 0.4;
            const buffer = state.audioCtx.createBuffer(1, bufferSize, state.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = state.audioCtx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = state.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, now);
            filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);
            
            const gain = state.audioCtx.createGain();
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(state.audioCtx.destination);
            
            noise.start(now);
            noise.stop(now + 0.4);
        }
        else if (type === 'pop') {
            const osc = state.audioCtx.createOscillator();
            const gain = state.audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
            
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            
            osc.connect(gain);
            gain.connect(state.audioCtx.destination);
            
            osc.start(now);
            osc.stop(now + 0.08);
        }
        else if (type === 'scratch') {
            const osc = state.audioCtx.createOscillator();
            const gain = state.audioCtx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120 + Math.random() * 300, now);
            
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            
            osc.connect(gain);
            gain.connect(state.audioCtx.destination);
            
            osc.start(now);
            osc.stop(now + 0.05);
        }
    }

    // Procedural ambient music loop
    function startMusicLoop() {
        if (state.isPlayingMusic) return;
        initAudioContext();
        if (state.audioCtx.state === 'suspended') {
            state.audioCtx.resume();
        }

        const now = state.audioCtx.currentTime;
        state.isPlayingMusic = true;

        let noteIdx = 0;
        const chords = [
            [261.63, 329.63, 392.00, 493.88], // Cmaj7
            [261.63, 293.66, 369.99, 440.00], // D/C
            [329.63, 392.00, 493.88, 587.33], // Em7
            [349.23, 440.00, 523.25, 659.25]  // Fmaj7
        ];
        
        let chordIdx = 0;

        function playNextNote() {
            if (!state.isPlayingMusic) return;

            const time = state.audioCtx.currentTime;
            const currentChord = chords[chordIdx];
            const baseFreq = currentChord[noteIdx % currentChord.length];
            const octave = (Math.random() > 0.6) ? 2 : 1;
            const frequency = baseFreq * octave;

            const osc = state.audioCtx.createOscillator();
            const gain = state.audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(frequency, time);

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.07, time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);

            osc.connect(gain);
            gain.connect(state.audioCtx.destination);

            osc.start(time);
            osc.stop(time + 1.3);

            noteIdx++;
            if (noteIdx % 8 === 0) {
                chordIdx = (chordIdx + 1) % chords.length;
            }

            state.musicNode = setTimeout(playNextNote, 350);
        }

        playNextNote();
    }

    function stopMusicLoop() {
        state.isPlayingMusic = false;
        if (state.musicNode) {
            clearTimeout(state.musicNode);
            state.musicNode = null;
        }
    }

    // --- CANVAS SYSTEMS (Background Particles & Confetti) ---
    function initCanvases() {
        state.bgCanvas = document.getElementById("background-canvas");
        state.confettiCanvas = document.getElementById("confetti-canvas");
        
        if (!state.bgCanvas) return;
        state.bgCtx = state.bgCanvas.getContext("2d");
        state.confettiCtx = state.confettiCanvas.getContext("2d");

        updateCanvasSizes();
        initThemeParticles();
    }

    function updateCanvasSizes() {
        state.canvasWidth = window.innerWidth;
        state.canvasHeight = window.innerHeight;

        if (state.bgCanvas) {
            state.bgCanvas.width = state.canvasWidth;
            state.bgCanvas.height = state.canvasHeight;
        }
        if (state.confettiCanvas) {
            state.confettiCanvas.width = state.canvasWidth;
            state.confettiCanvas.height = state.canvasHeight;
        }
    }

    function initWindowResize() {
        window.addEventListener("resize", () => {
            updateCanvasSizes();
        });
    }

    // Setup custom particle arrays based on theme
    function initThemeParticles() {
        state.activeParticles = [];
        const count = 50;

        if (state.theme === 'theme-mystic-night') {
            for (let i = 0; i < count; i++) {
                state.activeParticles.push({
                    x: Math.random() * state.canvasWidth,
                    y: Math.random() * state.canvasHeight,
                    size: Math.random() * 2 + 0.5,
                    opacity: Math.random(),
                    speed: Math.random() * 0.05 + 0.01,
                    direction: Math.random() * Math.PI * 2,
                    twinkleSpeed: Math.random() * 0.02 + 0.005,
                    type: 'star'
                });
            }
        } 
        else if (state.theme === 'theme-champagne-gold') {
            for (let i = 0; i < count; i++) {
                state.activeParticles.push({
                    x: Math.random() * state.canvasWidth,
                    y: Math.random() * state.canvasHeight + state.canvasHeight,
                    size: Math.random() * 4 + 1.5,
                    speed: Math.random() * 0.4 + 0.15,
                    drift: Math.sin(Math.random() * 10),
                    opacity: Math.random() * 0.5 + 0.25,
                    color: `hsl(${35 + Math.random() * 15}, 80%, ${65 + Math.random() * 15}%)`,
                    type: 'bubble'
                });
            }
        } 
        else if (state.theme === 'theme-cyber-synth') {
            for (let i = 0; i < 20; i++) {
                state.activeParticles.push({
                    x: Math.random() * state.canvasWidth,
                    y: Math.random() * state.canvasHeight,
                    size: Math.random() * 3 + 1,
                    speedY: Math.random() * 1 + 0.5,
                    color: Math.random() > 0.5 ? '#ff007f' : '#00f0ff',
                    type: 'cyberNode'
                });
            }
        } 
        else if (state.theme === 'theme-pastel-dreams') {
            for (let i = 0; i < 22; i++) {
                state.activeParticles.push({
                    x: Math.random() * state.canvasWidth,
                    y: Math.random() * state.canvasHeight,
                    size: Math.random() * 25 + 10,
                    speedX: (Math.random() - 0.5) * 0.3,
                    speedY: -Math.random() * 0.25 - 0.1,
                    color: `hsla(${Math.random() * 360}, 80%, 85%, 0.45)`,
                    type: 'pastelSphere'
                });
            }
        }
    }

    // MAIN ANIMATION LOOP
    function startBackgroundEffects() {
        function tick() {
            drawBackgroundParticles();
            drawConfettiSystem();
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function drawBackgroundParticles() {
        if (!state.bgCtx) return;
        const ctx = state.bgCtx;
        ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);

        if (state.theme === 'theme-cyber-synth') {
            ctx.strokeStyle = 'rgba(255, 0, 127, 0.1)';
            ctx.lineWidth = 1;
            const gridOffset = (Date.now() / 40) % 50;
            for (let y = gridOffset; y < state.canvasHeight; y += 50) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(state.canvasWidth, y);
                ctx.stroke();
            }
        }

        state.activeParticles.forEach(p => {
            if (p.type === 'star') {
                p.opacity += p.twinkleSpeed;
                if (p.opacity > 1 || p.opacity < 0.1) {
                    p.twinkleSpeed = -p.twinkleSpeed;
                }
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, p.opacity)})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } 
            else if (p.type === 'bubble') {
                p.y -= p.speed;
                p.x += Math.sin(p.y / 30) * 0.3;
                if (p.y < -10) {
                    p.y = state.canvasHeight + 10;
                    p.x = Math.random() * state.canvasWidth;
                }
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            } 
            else if (p.type === 'cyberNode') {
                p.y += p.speedY;
                if (p.y > state.canvasHeight) {
                    p.y = -10;
                    p.x = Math.random() * state.canvasWidth;
                }
                ctx.shadowBlur = 10;
                ctx.shadowColor = p.color;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } 
            else if (p.type === 'pastelSphere') {
                p.y += p.speedY;
                p.x += p.speedX;
                if (p.y < -p.size) {
                    p.y = state.canvasHeight + p.size;
                    p.x = Math.random() * state.canvasWidth;
                }
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    function drawConfettiSystem() {
        if (!state.confettiCtx) return;
        const ctx = state.confettiCtx;
        ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);

        state.activeConfetti.forEach((c, idx) => {
            c.y += c.speedY;
            c.x += c.speedX;
            c.rotation += c.rotationSpeed;

            if (c.y > state.canvasHeight + 10) {
                state.activeConfetti.splice(idx, 1);
                return;
            }

            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rotation);
            ctx.fillStyle = c.color;
            ctx.beginPath();
            if (c.shape === 'circle') {
                ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
            } else if (c.shape === 'triangle') {
                ctx.moveTo(0, -c.size / 2);
                ctx.lineTo(c.size / 2, c.size / 2);
                ctx.lineTo(-c.size / 2, c.size / 2);
                ctx.closePath();
            } else {
                ctx.rect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
            }
            ctx.fill();
            ctx.restore();
        });
    }

    function triggerConfettiBurst(count, clientX, clientY) {
        const shapes = ['rect', 'circle', 'triangle'];
        const colors = [
            '#ff7b93', '#bb86fc', '#03dac6', '#dfba73', '#ff007f', 
            '#00f0ff', '#ffeb3b', '#4caf50', '#ff5722'
        ];

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 8 + 3;
            state.activeConfetti.push({
                x: clientX,
                y: clientY,
                size: Math.random() * 12 + 6,
                speedX: Math.cos(angle) * velocity + (Math.random() - 0.5) * 2,
                speedY: Math.sin(angle) * velocity - Math.random() * 3,
                rotation: Math.random() * Math.PI,
                rotationSpeed: (Math.random() - 0.5) * 0.15,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: shapes[Math.floor(Math.random() * shapes.length)]
            });
        }
    }

    // --- GAMES ROUTINES ---
    function openGiftGame(type, giftCardElement) {
        const modal = document.getElementById("game-modal");
        modal.classList.remove("hidden");

        document.querySelectorAll(".game-screen").forEach(s => s.classList.add("hidden"));
        giftCardElement.classList.add("opened");

        if (type === 'cake') {
            document.getElementById("game-screen-cake").classList.remove("hidden");
            initCakeGame();
        } 
        else if (type === 'scratch') {
            document.getElementById("game-screen-scratch").classList.remove("hidden");
            initScratchGame();
        } 
        else if (type === 'balloon') {
            document.getElementById("game-screen-balloon").classList.remove("hidden");
            initBalloonGame();
        }
    }

    function closeGameModal() {
        document.getElementById("game-modal").classList.add("hidden");
        stopBalloonGame();
    }

    // --- GAME 1: CAKE CANDLE BLOW GAME ---
    function initCakeGame() {
        const canvas = document.getElementById("cake-canvas");
        const ctx = canvas.getContext("2d");
        state.games.cake.canvas = canvas;
        state.games.cake.ctx = ctx;
        state.games.cake.allBlown = false;

        document.getElementById("cake-result").classList.add("hidden");
        document.getElementById("cake-custom-msg").textContent = state.wishData ? state.wishData.gifts.cake : "Close your eyes & make a wish! 🎂✨";

        state.games.cake.candles = [
            { x: 130, y: 150, height: 60, lit: true, size: 8, flicker: 0 },
            { x: 200, y: 130, height: 60, lit: true, size: 8, flicker: 0 },
            { x: 270, y: 150, height: 60, lit: true, size: 8, flicker: 0 }
        ];

        const checkBlow = (x, y) => {
            if (state.games.cake.allBlown) return;
            
            state.games.cake.candles.forEach(c => {
                if (c.lit) {
                    const flameY = c.y - c.height;
                    const distance = Math.hypot(x - c.x, y - flameY);
                    if (distance < 25) {
                        c.lit = false;
                        playSfx('blow');
                        triggerConfettiBurst(20, c.x, flameY);
                    }
                }
            });

            const remaining = state.games.cake.candles.filter(c => c.lit);
            if (remaining.length === 0 && !state.games.cake.allBlown) {
                state.games.cake.allBlown = true;
                setTimeout(() => {
                    document.getElementById("cake-result").classList.remove("hidden");
                    triggerConfettiBurst(100, 200, 200);
                    playChimeSound();
                }, 800);
            }
        };

        canvas.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            checkBlow(x, y);
        };

        canvas.ontouchmove = (e) => {
            if (e.touches.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            checkBlow(x, y);
        };

        function drawCake() {
            if (document.getElementById("game-screen-cake").classList.contains("hidden")) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. Draw Plate
            ctx.fillStyle = '#cfd8dc';
            ctx.beginPath();
            ctx.ellipse(200, 310, 160, 45, 0, 0, Math.PI * 2);
            ctx.fill();

            // Plate shadow rim
            ctx.fillStyle = '#b0bec5';
            ctx.beginPath();
            ctx.ellipse(200, 316, 150, 36, 0, 0, Math.PI * 2);
            ctx.fill();

            // 2. Draw Bottom Tier
            ctx.fillStyle = '#ec407a';
            ctx.beginPath();
            ctx.ellipse(200, 290, 130, 35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(70, 210, 260, 80);
            ctx.beginPath();
            ctx.ellipse(200, 210, 130, 35, 0, 0, Math.PI * 2);
            ctx.fill();

            // Bottom Tier Frosting Details
            ctx.fillStyle = '#f8bbd0';
            ctx.beginPath();
            ctx.ellipse(200, 210, 128, 33, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(70, 210);
            for (let i = 70; i <= 330; i += 20) {
                const dripHeight = 10 + Math.sin(i / 15) * 15;
                ctx.quadraticCurveTo(i + 10, 210 + dripHeight, i + 20, 210);
            }
            ctx.fill();

            // 3. Draw Top Tier
            ctx.fillStyle = '#26c6da';
            ctx.beginPath();
            ctx.ellipse(200, 200, 90, 25, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(110, 140, 180, 60);
            ctx.beginPath();
            ctx.ellipse(200, 140, 90, 25, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#e0f7fa';
            ctx.beginPath();
            ctx.ellipse(200, 140, 88, 23, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(110, 140);
            for (let i = 110; i <= 290; i += 15) {
                const dripHeight = 8 + Math.cos(i / 10) * 12;
                ctx.quadraticCurveTo(i + 7.5, 140 + dripHeight, i + 15, 140);
            }
            ctx.fill();

            // 4. Draw Candles
            state.games.cake.candles.forEach(c => {
                ctx.fillStyle = '#ffeb3b';
                ctx.fillRect(c.x - 4, c.y - c.height, 8, c.height);
                ctx.fillStyle = '#ff5722';
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ff5722';
                ctx.beginPath();
                ctx.moveTo(c.x - 4, c.y - c.height + 10);
                ctx.lineTo(c.x + 4, c.y - c.height + 20);
                ctx.moveTo(c.x - 4, c.y - c.height + 30);
                ctx.lineTo(c.x + 4, c.y - c.height + 40);
                ctx.stroke();

                ctx.strokeStyle = '#424242';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(c.x, c.y - c.height);
                ctx.lineTo(c.x, c.y - c.height - 6);
                ctx.stroke();

                if (c.lit) {
                    c.flicker += 0.15;
                    const fSize = c.size + Math.sin(c.flicker) * 1.5;
                    const glowGrad = ctx.createRadialGradient(
                        c.x, c.y - c.height - 12, 1, 
                        c.x, c.y - c.height - 12, fSize * 2.5
                    );
                    glowGrad.addColorStop(0, '#fff');
                    glowGrad.addColorStop(0.3, '#ffeb3b');
                    glowGrad.addColorStop(0.8, 'rgba(255, 87, 34, 0.4)');
                    glowGrad.addColorStop(1, 'rgba(255, 87, 34, 0)');

                    ctx.fillStyle = glowGrad;
                    ctx.beginPath();
                    ctx.ellipse(c.x, c.y - c.height - 12, fSize * 0.8, fSize * 1.6, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            requestAnimationFrame(drawCake);
        }

        drawCake();

        document.getElementById("btn-cake-reset").onclick = () => {
            initCakeGame();
        };
    }

    // --- GAME 2: SCRATCH CARD GAME ---
    function initScratchGame() {
        const canvas = document.getElementById("scratch-canvas");
        const ctx = canvas.getContext("2d");
        state.games.scratch.canvas = canvas;
        state.games.scratch.ctx = ctx;
        state.games.scratch.percentScratched = 0;
        state.games.scratch.isComplete = false;

        const underlay = document.getElementById("scratch-underlay-content");
        underlay.innerHTML = '';

        const scratchMessage = state.wishData ? state.wishData.gifts.scratch : "Coupon: Good for 1 Late-Night Coffee!";
        const p1 = document.createElement("p");
        p1.textContent = "⭐ TICKET REVEAL ⭐";
        p1.style.fontSize = "0.75rem";
        p1.style.color = "var(--color-accent)";
        p1.style.letterSpacing = "2px";
        p1.style.marginBottom = "8px";

        const p2 = document.createElement("p");
        p2.textContent = scratchMessage;
        p2.style.fontWeight = "700";

        underlay.appendChild(p1);
        underlay.appendChild(p2);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#dfba73');
        grad.addColorStop(0.5, '#c5a059');
        grad.addColorStop(1, '#a67c37');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#141312';
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SCRATCH TO UNWRAP 🎁', canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = '500 12px Outfit, sans-serif';
        ctx.fillText('Swipe or click and drag', canvas.width / 2, canvas.height / 2 + 15);

        const checkScratchRatio = () => {
            if (state.games.scratch.isComplete) return;

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            let clearedCount = 0;

            const step = 16;
            let totalChecked = 0;
            for (let i = 3; i < data.length; i += step * 4) {
                totalChecked++;
                if (data[i] === 0) {
                    clearedCount++;
                }
            }

            const percent = (clearedCount / totalChecked) * 100;
            state.games.scratch.percentScratched = percent;

            if (percent > 55) {
                state.games.scratch.isComplete = true;
                canvas.style.transition = 'opacity 0.6s ease';
                canvas.style.opacity = '0';
                setTimeout(() => {
                    canvas.classList.add("hidden");
                }, 600);

                triggerConfettiBurst(50, canvas.width / 2 + canvas.getBoundingClientRect().left, canvas.height / 2 + canvas.getBoundingClientRect().top);
                playChimeSound();
            }
        };

        const scratch = (x, y) => {
            if (state.games.scratch.isComplete) return;
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, Math.PI * 2);
            ctx.fill();
            
            if (Math.random() > 0.65) {
                playSfx('scratch');
            }
            
            checkScratchRatio();
        };

        let isDrawing = false;
        canvas.onmousedown = (e) => {
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            scratch(e.clientX - rect.left, e.clientY - rect.top);
        };

        canvas.onmousemove = (e) => {
            if (!isDrawing) return;
            const rect = canvas.getBoundingClientRect();
            scratch(e.clientX - rect.left, e.clientY - rect.top);
        };

        window.onmouseup = () => {
            isDrawing = false;
        };

        canvas.ontouchstart = (e) => {
            isDrawing = true;
            if (e.touches.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            scratch(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        };

        canvas.ontouchmove = (e) => {
            if (!isDrawing) return;
            if (e.touches.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            scratch(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        };

        canvas.style.opacity = '1';
        canvas.style.transition = '';
        canvas.classList.remove("hidden");
    }

    // --- GAME 3: BALLOON POPPER ---
    function initBalloonGame() {
        const canvas = document.getElementById("balloon-canvas");
        const ctx = canvas.getContext("2d");
        state.games.balloon.canvas = canvas;
        state.games.balloon.ctx = ctx;
        state.games.balloon.score = 0;
        state.games.balloon.timeLeft = 15;
        state.games.balloon.balloons = [];
        state.games.balloon.isActive = true;

        document.getElementById("balloon-score").textContent = '0';
        document.getElementById("balloon-timer").textContent = '15';
        document.getElementById("balloon-result").classList.add("hidden");

        const balloonColors = ['#ff3366', '#33ccff', '#ffcc00', '#33cc33', '#cc33ff', '#ff6600'];

        const spawnBalloon = () => {
            if (!state.games.balloon.isActive) return;
            
            const radius = Math.random() * 15 + 20;
            state.games.balloon.balloons.push({
                x: Math.random() * (canvas.width - radius * 2) + radius,
                y: canvas.height + radius * 2,
                radius: radius,
                speedY: Math.random() * 2 + 1.2,
                color: balloonColors[Math.floor(Math.random() * balloonColors.length)],
                sway: Math.random() * 100,
                swaySpeed: Math.random() * 0.03 + 0.01
            });
        };

        clearInterval(state.games.balloon.gameInterval);
        state.games.balloon.gameInterval = setInterval(spawnBalloon, 450);

        clearInterval(state.games.balloon.timerInterval);
        state.games.balloon.timerInterval = setInterval(() => {
            state.games.balloon.timeLeft--;
            document.getElementById("balloon-timer").textContent = state.games.balloon.timeLeft;

            if (state.games.balloon.timeLeft <= 0) {
                stopBalloonGame();
                const customMsg = state.wishData ? state.wishData.gifts.balloon : "Game complete!";
                document.getElementById("balloon-custom-msg").innerHTML = `
                    Score: <b>${state.games.balloon.score} popped!</b><br>
                    <p style="margin-top:10px;font-size:0.9rem">${customMsg}</p>
                `;
                document.getElementById("balloon-result").classList.remove("hidden");
                triggerConfettiBurst(60, 200, 200);
                playChimeSound();
            }
        }, 1000);

        const popDetection = (x, y) => {
            if (!state.games.balloon.isActive) return;

            state.games.balloon.balloons.forEach((b, idx) => {
                const distance = Math.hypot(x - b.x, y - (b.y - b.radius * 0.2));
                if (distance < b.radius + 8) {
                    state.games.balloon.balloons.splice(idx, 1);
                    state.games.balloon.score++;
                    document.getElementById("balloon-score").textContent = state.games.balloon.score;
                    playSfx('pop');
                    triggerConfettiBurst(15, x, y);
                }
            });
        };

        canvas.onmousedown = (e) => {
            const rect = canvas.getBoundingClientRect();
            popDetection(e.clientX - rect.left, e.clientY - rect.top);
        };

        canvas.ontouchstart = (e) => {
            if (e.touches.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            popDetection(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        };

        function drawBalloons() {
            if (!state.games.balloon.isActive) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            state.games.balloon.balloons.forEach((b, idx) => {
                b.y -= b.speedY;
                b.sway += b.swaySpeed;
                b.x += Math.sin(b.sway) * 0.6;

                if (b.y < -b.radius * 2) {
                    state.games.balloon.balloons.splice(idx, 1);
                    return;
                }

                // String
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(b.x, b.y + b.radius * 1.2);
                ctx.quadraticCurveTo(b.x + Math.sin(b.sway)*8, b.y + b.radius * 1.2 + 20, b.x, b.y + b.radius * 1.2 + 40);
                ctx.stroke();

                // Balloon
                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.ellipse(b.x, b.y, b.radius * 0.9, b.radius * 1.2, 0, 0, Math.PI * 2);
                ctx.fill();

                // Knot
                ctx.beginPath();
                ctx.moveTo(b.x, b.y + b.radius * 1.15);
                ctx.lineTo(b.x - 6, b.y + b.radius * 1.35);
                ctx.lineTo(b.x + 6, b.y + b.radius * 1.35);
                ctx.closePath();
                ctx.fill();

                // Highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.beginPath();
                ctx.ellipse(b.x - b.radius * 0.35, b.y - b.radius * 0.45, b.radius * 0.25, b.radius * 0.4, Math.PI / 4, 0, Math.PI * 2);
                ctx.fill();
            });

            requestAnimationFrame(drawBalloons);
        }

        drawBalloons();

        document.getElementById("btn-balloon-reset").onclick = () => {
            initBalloonGame();
        };
    }

    function stopBalloonGame() {
        state.games.balloon.isActive = false;
        clearInterval(state.games.balloon.gameInterval);
        clearInterval(state.games.balloon.timerInterval);
    }
})();
