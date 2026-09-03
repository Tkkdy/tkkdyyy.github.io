document.addEventListener('DOMContentLoaded', () => {
            const projects = document.querySelectorAll('.project-container');

            projects.forEach(project => {
                // Click / Tap Toggle
                project.addEventListener('click', function(e) {
                    // Prevent default link actions from triggering flip (if links are simulated)
                    if (e.target.tagName.toLowerCase() === 'a' || window.getSelection().toString().length > 0) {
                        return;
                    }
                    toggleFlip(this);
                });

                // Keyboard Accessibility
                project.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault(); // Prevent scrolling down on space
                        toggleFlip(this);
                    }
                });
            });

            function toggleFlip(element) {
                const isFlipped = element.classList.toggle('flipped');
                element.setAttribute('aria-pressed', isFlipped.toString());
            }
        });
