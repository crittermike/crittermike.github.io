// gifenc 1.0.3 is vendored locally; its MIT license is in vendor/gifenc.LICENSE.txt.
import { GIFEncoder, quantize, applyPalette } from "./vendor/gifenc.esm.js";

export async function encodeGif(frames, delay, maxBytes) {
    const width = frames[0].width;
    const height = frames[0].height;
    const pixels = frames.map(frame => frame.getContext("2d").getImageData(0, 0, width, height).data);
    const opaque = new Uint8Array(pixels.length * width * height * 4);
    let length = 0;
    for (const frame of pixels) {
        for (let i = 0; i < frame.length; i += 4) {
            if (frame[i + 3] < 128) continue;
            opaque[length++] = frame[i];
            opaque[length++] = frame[i + 1];
            opaque[length++] = frame[i + 2];
            opaque[length++] = 255;
        }
    }
    if (!length) throw new Error("This animation has no visible pixels. Try different text or colors.");

    for (const maxColors of [63, 31, 15]) {
        const colors = quantize(opaque.subarray(0, length), maxColors, { format: "rgb444" });
        // Reserve index 0 for transparency, including disposal between moving frames.
        const palette = [[0, 0, 0], ...colors];
        const gif = GIFEncoder();
        for (let frame = 0; frame < pixels.length; frame++) {
            const rgba = pixels[frame];
            const indexed = applyPalette(rgba, colors, "rgb444");
            for (let i = 0; i < indexed.length; i++) {
                indexed[i] = rgba[i * 4 + 3] < 128 ? 0 : indexed[i] + 1;
            }
            gif.writeFrame(indexed, width, height, {
                palette: frame === 0 ? palette : undefined,
                colorDepth: Math.max(2, Math.ceil(Math.log2(palette.length))),
                transparent: true,
                transparentIndex: 0,
                dispose: 2,
                repeat: 0,
                delay
            });
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        gif.finish();
        const bytes = gif.bytes();
        if (bytes.length <= maxBytes) return new Blob([bytes], { type: "image/gif" });
    }
    throw new Error("This GIF exceeds Slack's 128 KB limit. Try shorter text or a simpler style.");
}
