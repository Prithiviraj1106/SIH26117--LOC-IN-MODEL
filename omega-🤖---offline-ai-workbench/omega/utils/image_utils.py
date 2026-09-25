"""
OMEGA AI Workbench - Image Processing Utilities
Prepares local image files for qwen2-vl:7b vision analysis.
Uses Pillow (PIL) and base64.
"""
import base64
import io
from typing import Optional, Tuple
from PIL import Image


def process_image_to_base64(
    image_input,
    max_dimension: int = 1536,
    quality: int = 85
) -> Tuple[Optional[str], Optional[Image.Image], Optional[str]]:
    """
    Reads an uploaded image (bytes or file-like object), validates it with Pillow,
    optionally resizes if exceeding max_dimension, and returns:
    (base64_string, PIL_Image, error_message)
    """
    if image_input is None:
        return None, None, "No image provided."
        
    try:
        if hasattr(image_input, "getvalue"):
            raw_bytes = image_input.getvalue()
        elif hasattr(image_input, "read"):
            raw_bytes = image_input.read()
        elif isinstance(image_input, bytes):
            raw_bytes = image_input
        else:
            return None, None, "Unsupported image input format."
            
        # Open and verify using Pillow
        img = Image.open(io.BytesIO(raw_bytes))
        
        # Convert RGBA to RGB for JPEG compatibility if needed
        if img.mode in ("RGBA", "P"):
            rgb_img = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "RGBA":
                rgb_img.paste(img, mask=img.split()[3])
            else:
                rgb_img.paste(img)
            img_to_encode = rgb_img
        else:
            img_to_encode = img.convert("RGB")
            
        # Resize if dimensions exceed threshold
        w, h = img_to_encode.size
        if max(w, h) > max_dimension:
            ratio = max_dimension / float(max(w, h))
            new_w = int(w * ratio)
            new_h = int(h * ratio)
            img_to_encode = img_to_encode.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
        # Save to buffer
        buffer = io.BytesIO()
        img_to_encode.save(buffer, format="JPEG", quality=quality)
        buffer.seek(0)
        
        b64_str = base64.b64encode(buffer.read()).decode("utf-8")
        return b64_str, img_to_encode, None
        
    except Exception as e:
        return None, None, f"Invalid image file: {str(e)}"
