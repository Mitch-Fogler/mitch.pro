const publicVapidKey = "BIuXi_VdGolze2Q3DgfsCjSVKWaxDMi2nkS6NkybXAOLuNu-8-LyeCMqC-daOxUsd2nnvr3QRfKgn-wSNNYs7iw";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

(async () => {
  if ("serviceWorker" in navigator && "PushManager" in window) {
    const sw = await navigator.serviceWorker.register("sw.js");
    console.log("Service Worker registered");

    let subscription = await sw.pushManager.getSubscription();
    if (!subscription) {
      subscription = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });
      console.log("Subscribed for push");
    } else {
      console.log("Already subscribed");
    }

    await fetch("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
    console.log("Subscription sent to server");
  } else {
    console.warn("Push messaging isn't supported");
  }
})();

