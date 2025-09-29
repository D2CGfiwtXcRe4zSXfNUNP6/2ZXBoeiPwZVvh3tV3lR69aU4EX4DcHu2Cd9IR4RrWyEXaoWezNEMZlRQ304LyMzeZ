function decode(str) {
  return atob(str);
}
const encodedPassword = "ODU0NTg2";
const correctPassword = decode(encodedPassword);

function unlockVault() {
  const inputField = document.getElementById("vaultPassword");
  const input = inputField.value;
  const message = document.getElementById("vaultMessage");

  if (input === correctPassword) {
    message.textContent = "Vault Unlocked!";
    message.className = "message unlocked";
    setTimeout(() => {
      window.location.href = "attd_home.html";
    }, 1000);
  } else {
    message.textContent = "Access Denied.";
    message.className = "message locked";
    inputField.value = "";
    inputField.focus();

    // Add shake class
    inputField.classList.add("shake");

    // Play error sound
    const audio = new Audio("error.mp3");
    audio.play();

    // Remove shake class after animation completes
    setTimeout(() => {
      inputField.classList.remove("shake");
    }, 500); // match animation duration
  }
}


