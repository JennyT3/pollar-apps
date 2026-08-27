import QRCode from "qrcode";
import { QR_DARK, QR_LIGHT } from "./tokens";

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: QR_DARK, light: QR_LIGHT },
  });
}
