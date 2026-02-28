console.log("System Online. Vought International Tracking Active.");

document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileToggle.classList.toggle('active');

            // Glitch effect on toggle
            document.body.classList.toggle('glitch-active');
            setTimeout(() => {
                document.body.classList.remove('glitch-active');
            }, 500);
        });
    }

    // Link Click Close Menu
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });

    // Random Glitch Enhancer for Title
    const glitchTitle = document.querySelector('.glitch-title');
    if (glitchTitle) {
        setInterval(() => {
            if (Math.random() > 0.95) {
                glitchTitle.style.textShadow = `
                    ${Math.random() * 10 - 5}px ${Math.random() * 10 - 5}px var(--color-primary),
                    ${Math.random() * 10 - 5}px ${Math.random() * 10 - 5}px var(--color-accent)
                `;
                glitchTitle.style.transform = `skew(${Math.random() * 20 - 10}deg)`;

                setTimeout(() => {
                    glitchTitle.style.transform = 'none';
                }, 100);
            }
        }, 200);
    }
});
