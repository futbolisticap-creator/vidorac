import atexit
import os
import ssl
import tempfile
from pathlib import Path

import certifi


_generated_bundle: Path | None = None


def configure_windows_ca_bundle() -> None:
    """Let curl_cffi validate with the same Windows roots as Vidorac."""
    global _generated_bundle
    if os.name != "nt" or os.environ.get("SSL_CERT_FILE"):
        return
    enum_certificates = getattr(ssl, "enum_certificates", None)
    if enum_certificates is None:
        return

    pem_roots: list[str] = []
    for certificate, encoding, _trust in enum_certificates("ROOT"):
        if encoding == "x509_asn":
            pem_roots.append(ssl.DER_cert_to_PEM_cert(certificate))
    if not pem_roots:
        return

    handle, path = tempfile.mkstemp(prefix="clipora-ca-", suffix=".pem")
    os.close(handle)
    bundle = Path(path)
    bundle.write_bytes(
        certifi.contents().encode("ascii")
        + b"\n"
        + "\n".join(pem_roots).encode("ascii")
    )
    _generated_bundle = bundle
    os.environ["SSL_CERT_FILE"] = str(bundle)

    def cleanup() -> None:
        if _generated_bundle is not None:
            _generated_bundle.unlink(missing_ok=True)

    atexit.register(cleanup)
