from PIL import Image, ImageEnhance, ImageOps

PRINT_WIDTH = 696

def line_halftone(image, spacing=6):
    """Create horizontal variable-width lines from grayscale artwork."""
    spacing = max(2, min(20, int(spacing)))
    width, height = image.size

    # Grayscale values: 0 = black, 255 = white.
    pixels = image.load()
    result = Image.new("L", (width, height), 255)
    output = result.load()

    for top in range(0, height, spacing):
        bottom = min(top + spacing, height)
        band_height = bottom - top
        center = band_height / 2

        for x in range(width):
            average = sum(pixels[x, y] for y in range(top, bottom)) / band_height
            thickness = (1 - average / 255) * band_height

            for y in range(top, bottom):
                distance = abs((y - top + 0.5) - center)
                if distance < thickness / 2:
                    output[x, y] = 0

    return result


def prepare_image(
    source,
    contrast=1.0,
    threshold=128,
    dither=False,
    method=None,
    line_spacing=6,
    background_cutoff=180,
    crop=None,
    rotate=0
):
    image = ImageOps.exif_transpose(source).convert("RGB")

    if crop is not None:
        x, y, w, h = crop

        left = round(x * image.width)
        top = round(y * image.height)
        right = round((x + w) * image.width)
        bottom = round((y + h) * image.height)

        left = max(0, min(image.width - 1, left))
        top = max(0, min(image.height - 1, top))
        right = max(left + 1, min(image.width, right))
        bottom = max(top + 1, min(image.height, bottom))

        image = image.crop((left, top, right, bottom))

    if rotate == 90:
        image = image.transpose(Image.Transpose.ROTATE_270)
    elif rotate != 0:
        raise ValueError("Unsupported print rotation")

    height = max(1, round(image.height * PRINT_WIDTH / image.width))
    image = image.resize(
        (PRINT_WIDTH, height),
        Image.Resampling.LANCZOS
    )

    image = ImageOps.grayscale(image)
    image = ImageEnhance.Contrast(image).enhance(contrast)

    if method is None:
        method = "floyd" if dither else "threshold"

    if method == "floyd":
        image = image.convert("1", dither=Image.Dither.FLOYDSTEINBERG)

    elif method == "line":
        cutoff = max(0, min(255, int(background_cutoff)))

        image = image.point(
            lambda pixel: 255 if pixel >= cutoff else pixel
        )

        image = line_halftone(
            image,
            spacing=line_spacing
        ).convert("1")

    elif method == "threshold":
        image = image.point(
            lambda pixel: 255 if pixel >= threshold else 0
        ).convert("1")

    else:
        raise ValueError(f"Unsupported processing method: {method}")

    return image.convert("RGB")
