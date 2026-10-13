import { useEffect, useState } from "react";

import { brl } from "@/lib/mock";

export type ThermalPaperWidth = "58mm" | "80mm";
export type ThermalLine = { name: string; quantity: number; unitPrice: number };
export type ThermalKeyValue = { label: string; value: string };

export type ThermalReceipt = {
  kind: "kitchen" | "payment" | "sale" | "summary" | "test";
  restaurant: string;
  cnpj?: string | undefined;
  documentId?: string | undefined;
  customer?: string | undefined;
  table?: string | undefined;
  operator?: string | undefined;
  createdAt?: string | undefined;
  items?: ThermalLine[] | undefined;
  showPrices?: boolean | undefined;
  fields?: ThermalKeyValue[] | undefined;
  subtotal?: number | undefined;
  discount?: number | undefined;
  total?: number | undefined;
  paymentMethod?: string | undefined;
  amountReceived?: number | undefined;
  change?: number | undefined;
  note?: string | undefined;
  footer?: string | undefined;
};

const PAPER_KEY_PREFIX = "restaurantai.thermal-width.";

export function useThermalPaperWidth(slug: string) {
  const [paperWidth, setPaperWidth] = useState<ThermalPaperWidth>("80mm");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`${PAPER_KEY_PREFIX}${slug}`);
      if (saved === "58mm" || saved === "80mm") setPaperWidth(saved);
    } catch {
      // Use 80mm if browser storage is unavailable.
    }
  }, [slug]);

  function changePaperWidth(width: ThermalPaperWidth) {
    setPaperWidth(width);
    try {
      window.localStorage.setItem(`${PAPER_KEY_PREFIX}${slug}`, width);
    } catch {
      // Keep the current session's width if local storage is unavailable.
    }
  }

  return { paperWidth, setPaperWidth: changePaperWidth };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function pair(label: string, value: string) {
  return `<div class="pair"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

export function printThermalReceipt(receipt: ThermalReceipt, paperWidth: ThermalPaperWidth = "80mm") {
  const printWindow = window.open("", "_blank", "width=420,height=760");
  if (!printWindow) return false;

  const widthInMm = paperWidth === "58mm" ? 54 : 74;
  const titleByKind: Record<ThermalReceipt["kind"], string> = {
    kitchen: "COMANDA · COZINHA",
    payment: "COMPROVANTE DE PAGAMENTO",
    sale: "RECIBO NÃO FISCAL",
    summary: "FECHAMENTO DO TURNO",
    test: "TESTE DE IMPRESSÃO",
  };
  const itemRows = (receipt.items ?? []).map((item) => `
    <div class="item"><div class="item-name">${item.quantity}x ${escapeHtml(item.name)}</div>${receipt.showPrices === false ? "" : `<div class="pair"><span>${brl(item.unitPrice)} un.</span><span>${brl(item.quantity * item.unitPrice)}</span></div>`}</div>
  `).join("");
  const fields = (receipt.fields ?? []).map((field) => pair(field.label, field.value)).join("");
  const totals = receipt.total === undefined ? "" : `
    ${receipt.subtotal === undefined ? "" : pair("Subtotal", brl(receipt.subtotal))}
    ${receipt.discount ? pair("Desconto", `- ${brl(receipt.discount)}`) : ""}
    <div class="pair total"><span>TOTAL</span><span>${brl(receipt.total)}</span></div>
  `;
  const payment = receipt.paymentMethod ? `
    ${pair("Pagamento", receipt.paymentMethod)}
    ${receipt.paymentMethod === "Dinheiro" && receipt.amountReceived !== undefined ? pair("Recebido", brl(receipt.amountReceived)) : ""}
    ${receipt.paymentMethod === "Dinheiro" && receipt.change !== undefined ? pair("Troco", brl(receipt.change)) : ""}
  ` : "";
  const metadata = [
    receipt.documentId ? pair("Pedido", receipt.documentId) : "",
    receipt.customer ? pair("Cliente", receipt.customer) : "",
    receipt.table ? pair("Mesa", receipt.table) : "",
    receipt.operator ? pair("Operador", receipt.operator) : "",
    pair("Data", receipt.createdAt ?? new Date().toLocaleString("pt-BR")),
  ].join("");
  const note = receipt.note ? `<div class="note"><strong>Observação</strong><br>${escapeHtml(receipt.note)}</div>` : "";
  const cnpj = pair("CNPJ", receipt.cnpj?.trim() || "Não informado");
  const footer = escapeHtml(receipt.footer ?? "Obrigado pela preferência!");

  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(titleByKind[receipt.kind])}</title><style>
    @page{size:${paperWidth} auto;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#111}
    body{width:${widthInMm}mm;margin:0 auto;padding:3mm 2mm;font:11px/1.35 "Courier New",Courier,monospace;overflow-wrap:anywhere}
    .center{text-align:center}.brand{font-size:15px;font-weight:700;line-height:1.2}.kind{margin-top:3px;font-size:10px;font-weight:700}
    .pair{display:flex;justify-content:space-between;gap:5px;margin:2px 0}.pair span:first-child{flex:1;min-width:0}.pair span:last-child{text-align:right;max-width:62%;overflow-wrap:anywhere}
    .cnpj{padding-bottom:5px;border-bottom:1px dashed #444;margin-bottom:5px}
    .metadata{padding:3px 0}.items{border-top:1px dashed #444;border-bottom:1px dashed #444;padding:4px 0;margin:4px 0}
    .item{padding:3px 0}.item-name{font-weight:700;overflow-wrap:anywhere}.total{font-size:13px;font-weight:700;border-top:1px dashed #444;padding-top:5px;margin-top:5px}
    .note{margin:5px 0;padding:4px 0;border-top:1px dashed #777;border-bottom:1px dashed #777}.footer{margin-top:9px;text-align:center}.cut{margin-top:8px;border-top:1px dashed #555;text-align:center;padding-top:3px;font-size:9px;color:#444}
    @media print{html,body{width:${widthInMm}mm;margin:0;padding:0;background:#fff}.receipt{padding:3mm 2mm}.cut{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><main class="receipt"><header class="center"><div class="brand">${escapeHtml(receipt.restaurant)}</div><div class="kind">${escapeHtml(titleByKind[receipt.kind])}</div></header><section class="cnpj">${cnpj}</section><section class="metadata">${metadata}${fields}</section>${itemRows ? `<section class="items">${itemRows}</section>` : ""}${note}${totals}${payment}<footer class="footer">${footer}</footer><div class="cut">- - - - - - - - CORTE - - - - - - - -</div></main></body></html>`);
  printWindow.document.close();
  window.setTimeout(() => {
    if (printWindow.closed) return;
    printWindow.focus();
    printWindow.print();
  }, 300);
  return true;
}
