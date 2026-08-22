import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="bg-warning flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium text-white"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      You&apos;re offline — changes may not be saved until you reconnect.
    </div>
  );
}
