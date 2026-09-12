import json
import sys

from .media_gallery import GalleryError, _extract_gallery_post_direct, _serialize_extraction


def main() -> int:
    if len(sys.argv) != 3:
        return 2
    url, platform = sys.argv[1:]
    try:
        extraction = _extract_gallery_post_direct(url, platform)
        payload = {"ok": True, "extraction": _serialize_extraction(extraction)}
    except GalleryError as exc:
        payload = {"ok": False, "error": type(exc).__name__}
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
