(function () {
  function setTimerButtonState(button, isRunning) {
    if (!button) return;

    const label = button.querySelector('span');
    if (!label) return;

    button.querySelectorAll('svg, i[data-lucide]').forEach(node => node.remove());

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', isRunning ? 'pause' : 'play');
    button.insertBefore(icon, label);

    label.textContent = isRunning ? 'Pause' : 'Start';
    button.classList.toggle('running', isRunning);
    button.setAttribute('aria-pressed', String(isRunning));

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  window.TimerLogic = {
    setTimerButtonState
  };
})();
