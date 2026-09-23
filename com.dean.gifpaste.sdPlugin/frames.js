// JXA: decode a GIF into square PNG frames for a Stream Deck key.
// Usage: osascript -l JavaScript frames.js <gif-path> <size> <max-frames>
// Prints JSON: [{ "ms": <duration>, "png": "<base64>" }, ...]
ObjC.import('AppKit');

function run(argv) {
  const src = argv[0];
  const size = Number(argv[1]) || 144;
  const maxFrames = Number(argv[2]) || 60;

  const data = $.NSData.dataWithContentsOfFile(src);
  if (data.isNil()) throw new Error('Cannot read ' + src);
  const rep = $.NSBitmapImageRep.imageRepWithData(data);
  if (rep.isNil()) throw new Error('Not a decodable image');

  const countObj = rep.valueForProperty($.NSImageFrameCount);
  const count = countObj.isNil() ? 1 : countObj.intValue;
  const step = Math.max(1, Math.ceil(count / maxFrames));

  const w = rep.pixelsWide, h = rep.pixelsHigh;
  const scale = Math.max(size / w, size / h); // fill + centre-crop
  const dw = w * scale, dh = h * scale;
  const rect = $.NSMakeRect((size - dw) / 2, (size - dh) / 2, dw, dh);

  const frames = [];
  for (let i = 0; i < count; i += step) {
    let ms = 0;
    for (let j = i; j < Math.min(i + step, count); j++) {
      rep.setPropertyWithValue($.NSImageCurrentFrame, $(j));
      const d = rep.valueForProperty($.NSImageCurrentFrameDuration);
      ms += d.isNil() ? 100 : Math.round(d.doubleValue * 1000);
    }
    rep.setPropertyWithValue($.NSImageCurrentFrame, $(i));

    const out = $.NSBitmapImageRep.alloc
      .initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
        null, size, size, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0);
    const ctx = $.NSGraphicsContext.graphicsContextWithBitmapImageRep(out);
    $.NSGraphicsContext.saveGraphicsState;
    $.NSGraphicsContext.setCurrentContext(ctx);
    ctx.setImageInterpolation($.NSImageInterpolationHigh);
    rep.drawInRect(rect);
    ctx.flushGraphics;
    $.NSGraphicsContext.restoreGraphicsState;

    const png = out.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}));
    frames.push({ ms, png: png.base64EncodedStringWithOptions(0).js });
  }
  return JSON.stringify(frames);
}
