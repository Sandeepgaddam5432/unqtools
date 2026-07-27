/**
 * Device Mockup Generator (Phone/Laptop) — pure logic.
 */

export type DeviceType = "iphone" | "pixel" | "macbook" | "ipad" | "surface";

export interface DeviceMockup {
  type: DeviceType;
  name: string;
  width: number;
  height: number;
  bezelTop: number;
  bezelBottom: number;
  bezelSide: number;
  borderRadius: number;
}

export const DEVICES: DeviceMockup[] = [
  { type: "iphone", name: "iPhone 15 Pro", width: 393, height: 852, bezelTop: 50, bezelBottom: 50, bezelSide: 12, borderRadius: 55 },
  { type: "pixel", name: "Pixel 8 Pro", width: 412, height: 892, bezelTop: 40, bezelBottom: 40, bezelSide: 10, borderRadius: 40 },
  { type: "macbook", name: "MacBook Pro 14", width: 1512, height: 982, bezelTop: 30, bezelBottom: 80, bezelSide: 30, borderRadius: 20 },
  { type: "ipad", name: "iPad Pro 12.9", width: 1024, height: 1366, bezelTop: 40, bezelBottom: 40, bezelSide: 40, borderRadius: 30 },
  { type: "surface", name: "Surface Pro", width: 960, height: 720, bezelTop: 25, bezelBottom: 25, bezelSide: 25, borderRadius: 10 },
];

export function getDevice(type: DeviceType): DeviceMockup | undefined {
  return DEVICES.find((d) => d.type === type);
}

export function generateMockupHtml(type: DeviceType, imageUrl: string, shadow: boolean = true): string {
  const device = getDevice(type);
  if (!device) return "";
  const totalWidth = device.width + device.bezelSide * 2;
  const totalHeight = device.height + device.bezelTop + device.bezelBottom;
  return `<div style="width:${totalWidth}px;height:${totalHeight}px;background:#1a1a1a;border-radius:${device.borderRadius}px;padding:${device.bezelTop}px ${device.bezelSide}px ${device.bezelBottom}px;${shadow ? "box-shadow:0 20px 60px rgba(0,0,0,0.3);" : ""}overflow:hidden;">
  <img src="${imageUrl}" alt="Screenshot" style="width:${device.width}px;height:${device.height}px;object-fit:cover;display:block;border-radius:${Math.max(0, device.borderRadius - 10)}px;"/>
</div>`;
}

export function getDevicesByCategory(category: "phone" | "tablet" | "laptop"): DeviceMockup[] {
  const phoneTypes: DeviceType[] = ["iphone", "pixel"];
  const tabletTypes: DeviceType[] = ["ipad", "surface"];
  const laptopTypes: DeviceType[] = ["macbook"];
  const types = category === "phone" ? phoneTypes : category === "tablet" ? tabletTypes : laptopTypes;
  return DEVICES.filter((d) => types.includes(d.type));
}

export function getDeviceList(): { value: DeviceType; label: string }[] {
  return DEVICES.map((d) => ({ value: d.type, label: d.name }));
}
