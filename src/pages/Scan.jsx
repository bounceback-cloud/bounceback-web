import { useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function Scan() {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });

    scanner.render(
      (decodedText) => {
        alert(`Scanned: ${decodedText}`);
        scanner.clear(); // stop after one scan
      },
      (errorMessage) => {
        console.log("QR Error:", errorMessage);
      }
    );

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner:", err));
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-xl font-bold mb-4">Scan QR Code</h1>
      <div id="reader" style={{ width: "300px" }}></div>
    </div>
  );
}
