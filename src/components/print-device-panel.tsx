import { Printer, Usb, Wallet } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/app-shell";
import { showToast } from "@/lib/toast";
import { printThermalReceipt, type ThermalPaperWidth } from "@/lib/thermal-print";

type UsbDeviceLike = { productName?: string };
type WebUsbLike = { requestDevice: (options: { filters: { classCode?: number }[] }) => Promise<UsbDeviceLike> };

export function PrintDevicePanel({ restaurant, slug, cnpj }: { restaurant: string; slug: string; cnpj?: string }) {
  const [paperWidth, setPaperWidth] = useState<ThermalPaperWidth>(() => {
    if (typeof window === "undefined") return "80mm";
    return window.localStorage.getItem(`restaurantai.thermal-width.${slug}`) === "58mm" ? "58mm" : "80mm";
  });
  const [networkAddress, setNetworkAddress] = useState("");
  const [printerStatus, setPrinterStatus] = useState("Impressora do sistema pronta");
  const [usbStatus, setUsbStatus] = useState("WebUSB não conectado");
  const [posConnected, setPosConnected] = useState(false);

  function changeWidth(width: ThermalPaperWidth) {
    setPaperWidth(width);
    try {
      window.localStorage.setItem(`restaurantai.thermal-width.${slug}`, width);
    } catch {
      // Keep the selected paper size for this screen session.
    }
  }

  async function connectUsb() {
    const usb = (navigator as Navigator & { usb?: WebUsbLike }).usb;
    if (!usb) {
      setUsbStatus("WebUSB indisponível neste navegador");
      showToast({ title: "WebUSB indisponível", description: "Use Chrome/Edge em HTTPS ou localhost, ou a impressão do sistema.", variant: "warning" });
      return;
    }
    try {
      const device = await usb.requestDevice({ filters: [{ classCode: 7 }, { classCode: 255 }] });
      setUsbStatus(`Pareado: ${device.productName || "dispositivo USB"}`);
      showToast({ title: "Dispositivo WebUSB pareado", description: "A impressão continuará usando o diálogo do sistema; envio ESC/POS requer um driver compatível.", variant: "success" });
    } catch {
      setUsbStatus("WebUSB não conectado");
    }
  }

  function simulateNetwork() {
    if (!networkAddress.trim()) {
      showToast({ title: "Informe a impressora", description: "Digite o endereço local configurado para o dispositivo.", variant: "warning" });
      return;
    }
    setPrinterStatus(`Rede local simulada · ${networkAddress.trim()}`);
    showToast({ title: "Teste de rede simulado", description: "Este painel não envia comandos TCP brutos ao hardware.", variant: "info" });
  }

  function testPrint() {
    const opened = printThermalReceipt({
      kind: "test",
      restaurantSlug: slug,
      restaurant,
      cnpj,
      documentId: `TESTE-${Date.now().toString().slice(-5)}`,
      fields: [
        { label: "Impressora", value: paperWidth },
        { label: "Status", value: "Teste de impressão" },
      ],
      footer: "Teste de impressão RestauranteAI",
    }, paperWidth);
    if (!opened) showToast({ title: "Pop-up bloqueado", description: "Permita pop-ups para abrir a impressão térmica.", variant: "warning" });
    else setPrinterStatus(`Teste enviado ao sistema · ${paperWidth}`);
  }

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Printer className="size-4 text-brand" />
          <div>
            <p className="text-[12px] font-semibold">Impressoras e POS</p>
            <p className="text-[10px] text-stone-500">{printerStatus}</p>
          </div>
        </div>
        <label className="text-[10px] font-medium text-stone-500">
          Bobina
          <select value={paperWidth} onChange={(event) => changeWidth(event.target.value as ThermalPaperWidth)} className="ml-2 rounded border border-black/10 bg-white px-2 py-1.5 text-[11px] text-ink">
            <option value="58mm">58 mm</option>
            <option value="80mm">80 mm</option>
          </select>
        </label>
        <button type="button" onClick={testPrint} className="rounded-md bg-brand px-3 py-2 text-[11px] font-semibold text-white hover:bg-brand-deep">Testar impressão</button>
      </div>
      <div className="mt-3 grid gap-2 border-t border-black/5 pt-3 md:grid-cols-3">
        <div className="flex min-w-0 items-center gap-2">
          <Usb className="size-4 shrink-0 text-stone-500" />
          <span className="min-w-0 flex-1 truncate text-[10px] text-stone-600">{usbStatus}</span>
          <button type="button" onClick={connectUsb} className="shrink-0 rounded border border-black/10 bg-white px-2 py-1 text-[10px] font-medium hover:bg-stone-50">Parear</button>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <input value={networkAddress} onChange={(event) => setNetworkAddress(event.target.value)} placeholder="IP da impressora" aria-label="Endereço local da impressora" className="min-w-0 flex-1 rounded border border-black/10 bg-white px-2 py-1.5 text-[10px]" />
          <button type="button" onClick={simulateNetwork} className="shrink-0 rounded border border-black/10 bg-white px-2 py-1 text-[10px] font-medium hover:bg-stone-50">Testar rede</button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] text-stone-600"><Wallet className="size-3.5" />POS {posConnected ? "conectado (simulação)" : "desconectado"}</span>
          <button type="button" onClick={() => setPosConnected((current) => !current)} className="rounded border border-black/10 bg-white px-2 py-1 text-[10px] font-medium hover:bg-stone-50">{posConnected ? "Desconectar" : "Simular POS"}</button>
        </div>
      </div>
    </Card>
  );
}
